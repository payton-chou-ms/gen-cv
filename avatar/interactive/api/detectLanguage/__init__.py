import logging
import os
from azure.ai.textanalytics import TextAnalyticsClient
from azure.core.credentials import AzureKeyCredential
import azure.functions as func

endpoint = os.getenv("TEXT_ANALYTICS_ENDPOINT")
subscription_key = os.getenv("TEXT_ANALYTICS_KEY")

def authenticate_client():
    ta_credential = AzureKeyCredential(subscription_key)
    text_analytics_client = TextAnalyticsClient(
        endpoint=endpoint, credential=ta_credential)
    return text_analytics_client

def main(req: func.HttpRequest) -> func.HttpResponse:
    text = req.params.get('text')
    if not text:
        return func.HttpResponse(
            "Please pass a text on the query string",
            status_code=400
        )

    client = authenticate_client()

    try:
        response = client.detect_language(documents=[{"id": "1", "text": text}])
        language_code = response[0].primary_language.iso6391_name

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
            "zh_cht": "zh-CN",
            "ar": "ar-AE"
        }

        return func.HttpResponse(language_to_voice.get(language_code, "zh-CN"), status_code=200)
    except Exception as e:
        logging.error(f"Error detecting language: {e}")
        return func.HttpResponse("Error detecting language", status_code=500)