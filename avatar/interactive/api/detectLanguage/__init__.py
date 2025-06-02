import logging
import os
from azure.ai.textanalytics import TextAnalyticsClient
from azure.core.credentials import AzureKeyCredential
import azure.functions as func
from azure.core.exceptions import HttpResponseError
import openai
from azure.identity import DefaultAzureCredential

# 文本分析服務設置
endpoint = os.getenv("TEXT_ANALYTICS_ENDPOINT")
subscription_key = os.getenv("TEXT_ANALYTICS_KEY")

# Azure OpenAI 服務設置
openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
openai_key = os.getenv("AZURE_OPENAI_API_KEY")  # 使用正確的環境變量名稱
openai_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o")  # 使用 CHAT_DEPLOYMENT 環境變量
openai_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")  # 使用 API_VERSION 環境變量

# 支援的語言列表 (與前端 main.js 保持一致)
SUPPORTED_LANGUAGES = ["en-US", "zh-TW", "ja-JP", "ko-KR"]

def authenticate_client():
    ta_credential = AzureKeyCredential(subscription_key)
    text_analytics_client = TextAnalyticsClient(
        endpoint=endpoint, credential=ta_credential)
    return text_analytics_client

def setup_openai_client():
    # 設置 Azure OpenAI 客戶端
    openai.api_type = "azure"
    openai.api_base = openai_endpoint
    openai.api_version = openai_api_version  # 使用從環境變量獲取的 API 版本
    openai.api_key = openai_key

def analyze_language_intent(text):
    """使用 Azure OpenAI 服務分析用戶想要使用的語言"""
    try:
        setup_openai_client()
        
        # 構建提示以分析用戶意圖，限制為支持的四種語言
        prompt = f"""請分析以下文本，判斷用戶是否表達了希望使用特定語言的意圖：
        
        文本: "{text}"
        
        僅考慮以下語言選項：
        - en-US（英文）
        - zh-TW（繁體中文）
        - ja-JP（日文）
        - ko-KR（韓文）
        
        如果文本中明確表達了希望使用以上某種語言的意圖（例如：「請用日文介紹」表示使用日文），請回答該語言的代碼（例如：ja-JP）。
        如果沒有明確表達語言意圖，請回答 "NONE"。
        
        特別注意：如果用戶明確提及「日文」、「日語」或類似意思的詞語，請回答 "ja-JP"。
        
        只回答語言代碼或 "NONE"，不要包含其他解釋。"""
        
        response = openai.ChatCompletion.create(
            engine=openai_deployment,
            messages=[
                {"role": "system", "content": "你是一個語言分析助手，幫助判斷用戶想要使用的語言。"},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50,
            temperature=0.0  # 使用低溫度以獲得一致的回答
        )
        
        # 解析回應
        language_code = response.choices[0].message.content.strip()
        logging.info(f"OpenAI language intent analysis result: {language_code}")
        
        # 如果回答不是 "NONE"，則返回檢測到的語言代碼
        if language_code != "NONE" and language_code in SUPPORTED_LANGUAGES:
            return language_code
        
        return None  # 沒有檢測到特定語言意圖
        
    except Exception as e:
        logging.error(f"Error analyzing language intent: {e}")
        return None  # 發生錯誤時返回 None

def main(req: func.HttpRequest) -> func.HttpResponse:
    text = req.params.get('text')
    if not text:
        try:
            req_body = req.get_json()
            text = req_body.get('text')
        except ValueError:
            pass

    if not text:
        return func.HttpResponse(
            "Please pass a text on the query string or in the request body",
            status_code=400
        )

    logging.info(f"Processing text: {text}")

    try:
        # 首先嘗試使用 OpenAI 進行語意分析
        intent_language = analyze_language_intent(text)
        if intent_language and intent_language in SUPPORTED_LANGUAGES:
            logging.info(f"Language intent detected: {intent_language}")
            return func.HttpResponse(intent_language, status_code=200)
        
        # 如果語意分析沒有找到特定語言意圖，則使用語言檢測
        client = authenticate_client()
        response = client.detect_language(documents=[{"id": "1", "text": text}])
        language_code = response[0].primary_language.iso6391_name
        logging.info(f"Detected language code: {language_code}")

        language_to_voice = {
            "de": "de-DE",
            "en": "en-US",
            "es": "es-ES",
            "fr": "fr-FR",
            "it": "it-IT",
            "ja": "ja-JP",
            "ko": "ko-KR",
            "pt": "pt-BR",
            "zh_chs": "zh-CN",
            "zh_cht": "zh-TW",
            "ar": "ar-AE"
        }

        detected_voice = language_to_voice.get(language_code, "zh-TW")
        logging.info(f"Mapped to voice: {detected_voice}")
        
        # 確保返回的語言代碼在支持的列表中，如果不在則默認使用繁體中文
        if detected_voice not in SUPPORTED_LANGUAGES:
            detected_voice = "zh-TW"
            logging.info(f"Voice not in supported languages, defaulting to: {detected_voice}")
            
        return func.HttpResponse(detected_voice, status_code=200)
    except Exception as e:
        logging.error(f"Error in language processing: {e}")
        return func.HttpResponse("Error processing language", status_code=500)