// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

var system_prompt = `You are an AI assistant focused on delivering brief product details and assisting with the ordering process.
- Before calling a function, aim to answer product queries using existing conversational context.
- If the product information isn't clear or available, consult get_product_information for accurate details. Never invent answers.  
- Address customer account or order-related queries with the appropriate functions.
- Before seeking account specifics (like account_id), scan previous parts of the conversation. Reuse information if available, avoiding repetitive queries.
- NEVER GUESS FUNCTION INPUTS! If a user's request is unclear, request further clarification. 
- Provide responses within 3 sentences, emphasizing conciseness and accuracy.
- If not specified otherwise, the account_id of the current user is 1000
- Pay attention to the language the customer is using in their latest statement and respond in the same language!
`

// Update this value if you want to use a different voice
const TTSVoice = "zh-CN-XiaochenMultilingualNeural"
// const TTSVoice = "en-US-CoraMultilingualNeural"

// Fill your Azure cognitive services region here, e.g. westus2
const CogSvcRegion = "westus2"

const IceServerUrl = "turn:relay.communication.microsoft.com:3478" // Fill your ICE server URL here, e.g. turn:turn.azure.com:3478
let IceServerUsername
let IceServerCredential

// const TalkingAvatarCharacter = "lisa"
const TalkingAvatarCharacter = "lisa"
const TalkingAvatarStyle = "casual-sitting"
// The language detection engine supports a maximum of 4 languages
supported_languages = ["en-US", "zh-TW"]

let token

const speechSynthesisConfig = SpeechSDK.SpeechConfig.fromEndpoint(new URL("wss://{region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?enableTalkingAvatar=true".replace("{region}", CogSvcRegion)))

// Global objects
var speechSynthesizer
var avatarSynthesizer
var peerConnection
var previousAnimationFrameTimestamp = 0
var keepAliveInterval = null  // 用於存儲 keepalive 計時器
var keepAliveIntervalTime = 60000  // keepalive 時間間隔，預設 60 秒
var maxKeepAliveAttempts = 20  // 最大 keepalive 嘗試次數，預設為 2
var keepAliveAttemptCount = 0  // 當前已執行的 keepalive 次數

messages = [{ "role": "system", "content": system_prompt }];

function removeDocumentReferences(str) {
  // Regular expression to match [docX]
  var regex = /\[doc\d+\]/g;

  // Replace document references with an empty string
  var result = str.replace(regex, '');

  return result;
}

// Setup WebRTC
function setupWebRTC() {
  // Create WebRTC peer connection
  fetch("/api/getIceServerToken", {
    method: "POST"
  })
    .then(async res => {
      const reponseJson = await res.json()
      peerConnection = new RTCPeerConnection({
        iceServers: [{
          urls: reponseJson["Urls"],
          username: reponseJson["Username"],
          credential: reponseJson["Password"]
        }]
      })

      // Fetch WebRTC video stream and mount it to an HTML video element
      peerConnection.ontrack = function (event) {
        console.log('peerconnection.ontrack', event)
        // Clean up existing video element if there is any
        remoteVideoDiv = document.getElementById('remoteVideo')
        for (var i = 0; i < remoteVideoDiv.childNodes.length; i++) {
          if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
            remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i])
          }
        }

        const videoElement = document.createElement(event.track.kind)
        videoElement.id = event.track.kind
        videoElement.srcObject = event.streams[0]
        videoElement.autoplay = true
        videoElement.controls = false
        document.getElementById('remoteVideo').appendChild(videoElement)

        canvas = document.getElementById('canvas')
        remoteVideoDiv.hidden = true
        canvas.hidden = false

        videoElement.addEventListener('play', () => {
          remoteVideoDiv.style.width = videoElement.videoWidth / 2 + 'px'
          window.requestAnimationFrame(makeBackgroundTransparent)
        })
      }

      // Make necessary update to the web page when the connection state changes
      peerConnection.oniceconnectionstatechange = e => {
        console.log("WebRTC status: " + peerConnection.iceConnectionState)

        if (peerConnection.iceConnectionState === 'connected') {
          document.getElementById('loginOverlay').classList.add("hidden");
        }

        if (peerConnection.iceConnectionState === 'disconnected') {
        }
      }

      // Offer to receive 1 audio, and 1 video track
      peerConnection.addTransceiver('video', { direction: 'sendrecv' })
      peerConnection.addTransceiver('audio', { direction: 'sendrecv' })

      // start avatar, establish WebRTC connection
      avatarSynthesizer.startAvatarAsync(peerConnection).then((r) => {
        if (r.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          console.log("[" + (new Date()).toISOString() + "] Avatar started. Result ID: " + r.resultId)
          greeting()
        } else {
          console.log("[" + (new Date()).toISOString() + "] Unable to start avatar. Result ID: " + r.resultId)
          if (r.reason === SpeechSDK.ResultReason.Canceled) {
            let cancellationDetails = SpeechSDK.CancellationDetails.fromResult(r)
            if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
              console.log(cancellationDetails.errorDetails)
            };

            console.log("Unable to start avatar: " + cancellationDetails.errorDetails);
          }
        }
      }).catch(
        (error) => {
          console.log("[" + (new Date()).toISOString() + "] Avatar failed to start. Error: " + error)
          document.getElementById('startSession').disabled = false
          document.getElementById('configuration').hidden = false
        }
      )

    })
}

async function generateText(prompt) {

  messages.push({
    role: 'user',
    content: prompt
  });

  let generatedText
  let products
  await fetch(`/api/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(messages) })
    .then(response => response.json())
    .then(data => {
      generatedText = data["messages"][data["messages"].length - 1].content;
      messages = data["messages"];
      products = data["products"]
    });

  addToConversationHistory(generatedText, 'light');
  if (products.length > 0) {
    addProductToChatHistory(products[0]);
  }
  return generatedText;
}

// Connect to TTS Avatar API
function connectToAvatarService() {
  // Construct TTS Avatar service request
  let videoCropTopLeftX = 600
  let videoCropBottomRightX = 1320
  let backgroundColor = '#00FF00FF'

  const videoFormat = new SpeechSDK.AvatarVideoFormat()
  videoFormat.setCropRange(new SpeechSDK.Coordinate(videoCropTopLeftX, 0), new SpeechSDK.Coordinate(videoCropBottomRightX, 1080));

  const avatarConfig = new SpeechSDK.AvatarConfig(TalkingAvatarCharacter, TalkingAvatarStyle, videoFormat)
  avatarConfig.backgroundColor = backgroundColor

  avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig)
  avatarSynthesizer.avatarEventReceived = function (s, e) {
    var offsetMessage = ", offset from session start: " + e.offset / 10000 + "ms."
    if (e.offset === 0) {
      offsetMessage = ""
    }
    console.log("Event received: " + e.description + offsetMessage)
  }

  // 啟動 keepalive 機制
  startKeepAlive();
}

// Keepalive 機制函數
function startKeepAlive() {
  // 清除任何現有的 keepalive 定時器
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  // 重置 keepalive 計數
  keepAliveAttemptCount = 0;

  // 創建新的 keepalive 定時器
  keepAliveInterval = setInterval(() => {
    if (avatarSynthesizer && peerConnection) {
      // 檢查 WebRTC 連接狀態
      if (peerConnection.iceConnectionState === 'connected' || 
          peerConnection.iceConnectionState === 'completed') {
        
        // 檢查是否已達到最大嘗試次數
        if (keepAliveAttemptCount >= maxKeepAliveAttempts) {
          console.log("[" + (new Date()).toISOString() + "] Maximum keepalive attempts reached (" + maxKeepAliveAttempts + "), stopping keepalive");
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
          return;
        }
        
        // 增加計數
        keepAliveAttemptCount++;
        
        console.log("[" + (new Date()).toISOString() + "] Sending keepalive signal (attempt " + keepAliveAttemptCount + " of " + maxKeepAliveAttempts + ")");
        
        // 使用靜音 SSML 以保持連接活躍
        const keepAliveSSML = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='en-US'>
          <voice xml:lang='en-US' xml:gender='Female' name='zh-CN-XiaochenMultilingualNeural'>
            <mstts:silence type="Tailing" value="5ms"/>
          </voice>
        </speak>`;
        
        avatarSynthesizer.speakSsmlAsync(keepAliveSSML, (result) => {
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log("[" + (new Date()).toISOString() + "] Keepalive signal sent");
          } else {
            console.log("[" + (new Date()).toISOString() + "] Failed to send keepalive");
            if (result.reason === SpeechSDK.ResultReason.Canceled) {
              let cancellationDetails = SpeechSDK.CancellationDetails.fromResult(result);
              console.log("Keepalive canceled: " + cancellationDetails.reason);
              
              // 如果連接已斷開，嘗試重新連接
              if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
                console.log("Keepalive error: " + cancellationDetails.errorDetails);
                attemptReconnect();
              }
            }
          }
        });
      } else if (peerConnection.iceConnectionState === 'disconnected' || 
                 peerConnection.iceConnectionState === 'failed' ||
                 peerConnection.iceConnectionState === 'closed') {
        console.log("[" + (new Date()).toISOString() + "] Connection lost, attempting to reconnect");
        attemptReconnect();
      }
    }
  }, keepAliveIntervalTime); // 使用變數設定時間間隔
}

// 新增: 嘗試重新連接
function attemptReconnect() {
  // 停止現有的 keepalive
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }

  // 關閉現有連接
  if (speechSynthesizer) {
    speechSynthesizer.close();
  }

  if (avatarSynthesizer) {
    avatarSynthesizer = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // 延遲2秒後重新連接
  setTimeout(() => {
    console.log("[" + (new Date()).toISOString() + "] Attempting to reconnect");

    // 重新請求 token 並重新啟動服務
    fetch("/api/getSpeechToken", {
      method: "POST"
    })
      .then(response => response.text())
      .then(response => {
        speechSynthesisConfig.authorizationToken = response;
        token = response;

        speechSynthesizer = new SpeechSDK.SpeechSynthesizer(speechSynthesisConfig, null);
        connectToAvatarService();
        setupWebRTC();

        console.log("[" + (new Date()).toISOString() + "] Reconnection setup completed");
      })
      .catch(error => {
        console.error("[" + (new Date()).toISOString() + "] Reconnection failed: ", error);
        // 稍後再次嘗試重新連接
        setTimeout(attemptReconnect, 30000);
      });
  }, 2000);
}

window.startSession = () => {
  var iconElement = document.createElement("i");
  iconElement.className = "fa fa-spinner fa-spin";
  iconElement.id = "loadingIcon"
  var parentElement = document.getElementById("playVideo");
  parentElement.prepend(iconElement);

  speechSynthesisConfig.speechSynthesisVoiceName = TTSVoice
  document.getElementById('playVideo').className = "round-button-hide"

  fetch("/api/getSpeechToken", {
    method: "POST"
  })
    .then(response => response.text())
    .then(response => {
      speechSynthesisConfig.authorizationToken = response;
      token = response
    })
    .then(() => {
      speechSynthesizer = new SpeechSDK.SpeechSynthesizer(speechSynthesisConfig, null)
      connectToAvatarService()
      setupWebRTC()
    })
}

async function greeting() {
  addToConversationHistory("你好，我是 Lisa。請問有什麼需要協助的？", "light")

  let spokenText = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='zh-TW'><voice xml:lang='zh-TW' xml:gender='Female' name='zh-CN-XiaochenMultilingualNeural'>你好，我是 Lisa。請問有什麼需要協助的？</voice></speak>"
  avatarSynthesizer.speakSsmlAsync(spokenText, (result) => {
    if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
      console.log("Speech synthesized to speaker for text [ " + spokenText + " ]. Result ID: " + result.resultId)
    } else {
      console.log("Unable to speak text. Result ID: " + result.resultId)
      if (result.reason === SpeechSDK.ResultReason.Canceled) {
        let cancellationDetails = SpeechSDK.CancellationDetails.fromResult(result)
        console.log(cancellationDetails.reason)
        if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
          console.log(cancellationDetails.errorDetails)
        }
      }
    }
  })
}

window.speak = (text) => {
  async function speak(text) {
    // 用戶進行交談，重置 keepalive 計數
    keepAliveAttemptCount = 0;

    addToConversationHistory(text, 'dark')

    fetch("/api/detectLanguage?text=" + text, {
      method: "POST"
    })
      .then(response => response.text())
      .then(async language => {
        console.log(`Detected language: ${language}`);

        const generatedResult = await generateText(text);

        let spokenTextssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='en-US'><voice xml:lang='en-US' xml:gender='Female' name='zh-CN-XiaochenMultilingualNeural'><lang xml:lang="${language}">${generatedResult}</lang></voice></speak>`

        if (language == 'ar-AE') {
          spokenTextssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='en-US'><voice xml:lang='en-US' xml:gender='Female' name='ar-AE-FatimaNeural'><lang xml:lang="${language}">${generatedResult}</lang></voice></speak>`
        }
        let spokenText = generatedResult
        avatarSynthesizer.speakSsmlAsync(spokenTextssml, (result) => {
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log("Speech synthesized to speaker for text [ " + spokenText + " ]. Result ID: " + result.resultId)
          } else {
            console.log("Unable to speak text. Result ID: " + result.resultId)
            if (result.reason === SpeechSDK.ResultReason.Canceled) {
              let cancellationDetails = SpeechSDK.CancellationDetails.fromResult(result)
              console.log(cancellationDetails.reason)
              if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
                console.log(cancellationDetails.errorDetails)
              }
            }
          }
        })
      })
      .catch(error => {
        console.error('Error:', error);
      });
  }
  speak(text);
}

window.stopSession = () => {
  // 清除 keepalive 定時器
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }

  speechSynthesizer.close()
}

window.startRecording = () => {
  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, CogSvcRegion);
  speechConfig.authorizationToken = token;
  speechConfig.SpeechServiceConnection_LanguageIdMode = "Continuous";
  // var autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(supported_languages);
  var autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(["zh-TW"]);

  document.getElementById('buttonIcon').className = "fas fa-stop"
  document.getElementById('startRecording').disabled = true

  recognizer = SpeechSDK.SpeechRecognizer.FromConfig(speechConfig, autoDetectSourceLanguageConfig);

  recognizer.recognized = function (s, e) {
    if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
      console.log('Recognized:', e.result.text);
      window.stopRecording();
      // TODO: append to conversation
      window.speak(e.result.text);
    }
  };

  recognizer.startContinuousRecognitionAsync();

  console.log('Recording started.');
}

window.stopRecording = () => {
  if (recognizer) {
    recognizer.stopContinuousRecognitionAsync(
      function () {
        recognizer.close();
        recognizer = undefined;
        document.getElementById('buttonIcon').className = "fas fa-microphone"
        document.getElementById('startRecording').disabled = false
        console.log('Recording stopped.');
      },
      function (err) {
        console.error('Error stopping recording:', err);
      }
    );
  }
}

window.submitText = () => {
  document.getElementById('spokenText').textContent = document.getElementById('textinput').currentValue
  document.getElementById('textinput').currentValue = ""
  window.speak(document.getElementById('textinput').currentValue);
}

// 新增函數：設定 keepalive 參數
window.setKeepAliveParams = (intervalTime, maxAttempts) => {
  if (intervalTime && typeof intervalTime === 'number' && intervalTime > 0) {
    keepAliveIntervalTime = intervalTime;
    console.log("[" + (new Date()).toISOString() + "] Keepalive interval time set to " + keepAliveIntervalTime + "ms");
  }
  
  if (maxAttempts && typeof maxAttempts === 'number' && maxAttempts >= 0) {
    maxKeepAliveAttempts = maxAttempts;
    console.log("[" + (new Date()).toISOString() + "] Max keepalive attempts set to " + maxKeepAliveAttempts);
  }
  
  // 如果 keepalive 已經在運行，重新啟動以應用新設定
  if (keepAliveInterval) {
    startKeepAlive();
  }
}

function addToConversationHistory(item, historytype) {
  const list = document.getElementById('chathistory');
  const newItem = document.createElement('li');
  newItem.classList.add('message');
  newItem.classList.add(`message--${historytype}`);
  newItem.textContent = item;
  list.appendChild(newItem);
}

function addProductToChatHistory(product) {
  const list = document.getElementById('chathistory');
  const listItem = document.createElement('li');
  listItem.classList.add('product');
  listItem.innerHTML = `
    <fluent-card class="product-card">
      <div class="product-card__header">
        <img src="${product.image_url}" alt="tent" width="100%">
      </div>
      <div class="product-card__content">
        <div><span class="product-card__price">$${product.special_offer}</span> <span class="product-card__old-price">$${product.original_price}</span></div>
        <div>${product.tagline}</div>
      </div>
    </fluent-card>
  `;
  list.appendChild(listItem);
}

// Make video background transparent by matting
function makeBackgroundTransparent(timestamp) {
  // Throttle the frame rate to 30 FPS to reduce CPU usage
  if (timestamp - previousAnimationFrameTimestamp > 30) {
    video = document.getElementById('video')
    tmpCanvas = document.getElementById('tmpCanvas')
    tmpCanvasContext = tmpCanvas.getContext('2d', { willReadFrequently: true })
    tmpCanvasContext.drawImage(video, 0, 0, video.videoWidth, video.videoHeight)
    if (video.videoWidth > 0) {
      let frame = tmpCanvasContext.getImageData(0, 0, video.videoWidth, video.videoHeight)
      for (let i = 0; i < frame.data.length / 4; i++) {
        let r = frame.data[i * 4 + 0]
        let g = frame.data[i * 4 + 1]
        let b = frame.data[i * 4 + 2]

        if (g - 150 > r + b) {
          // Set alpha to 0 for pixels that are close to green
          frame.data[i * 4 + 3] = 0
        } else if (g + g > r + b) {
          // Reduce green part of the green pixels to avoid green edge issue
          adjustment = (g - (r + b) / 2) / 3
          r += adjustment
          g -= adjustment * 2
          b += adjustment
          frame.data[i * 4 + 0] = r
          frame.data[i * 4 + 1] = g
          frame.data[i * 4 + 2] = b
          // Reduce alpha part for green pixels to make the edge smoother
          a = Math.max(0, 255 - adjustment * 4)
          frame.data[i * 4 + 3] = a
        }
      }

      canvas = document.getElementById('canvas')
      canvasContext = canvas.getContext('2d')
      canvasContext.putImageData(frame, 0, 0);
    }

    previousAnimationFrameTimestamp = timestamp
  }

  window.requestAnimationFrame(makeBackgroundTransparent)
}
