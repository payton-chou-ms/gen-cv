import logging
import os
import json
import requests
from datetime import datetime, timedelta
import pyodbc

import azure.functions as func

search_endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
search_key = os.getenv("AZURE_SEARCH_API_KEY") 
search_api_version = '2023-07-01-Preview'
search_index_name = os.getenv("AZURE_SEARCH_INDEX")

AOAI_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
AOAI_key = os.getenv("AZURE_OPENAI_API_KEY")
AOAI_api_version = os.getenv("AZURE_OPENAI_API_VERSION")
embeddings_deployment = os.getenv("AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT")
chat_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT")
use_app_registration = os.getenv("USE_APP_REGISTRATION")
# sql_db_server = os.getenv("SQL_DB_SERVER")
# sql_db_user = os.getenv("SQL_DB_USER")
# sql_db_password = os.getenv("SQL_DB_PASSWORD")
# sql_db_name = os.getenv("SQL_DB_NAME")

blob_sas_url = os.getenv("BLOB_SAS_URL")

# server_connection_string = f"Driver={{ODBC Driver 17 for SQL Server}};Server=tcp:{sql_db_server},1433;Uid={sql_db_user};Pwd={sql_db_password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
# database_connection_string = server_connection_string + f"Database={sql_db_name};"

# font color adjustments
blue, end_blue = '\033[36m', '\033[0m'

place_orders = False

functions = [
        {
        "name": "get_product_information",
        "description": "Find information about a product based on a user question. Use only if the requested information if not already available in the conversation context.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_question": {
                    "type": "string",
                    "description": "User question (i.e., do you have tennis shoes for men?, etc.)"
                },
            },
            "required": ["user_question"],
        }
    }
]

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    messages = json.loads(req.get_body())

    response = chat_complete(messages, functions= functions, function_call= "auto")

    products = []
    
    try:
        response_message = response["choices"][0]["message"]
    except:
        logging.info(response)

    # if the model wants to call a function
    if response_message.get("function_call"):
        # Call the function. The JSON response may not always be valid so make sure to handle errors
        function_name = response_message["function_call"]["name"]

        available_functions = {
                "get_product_information": get_product_information,
        }
        function_to_call = available_functions[function_name] 

        function_args = json.loads(response_message["function_call"]["arguments"])
        function_response = function_to_call(**function_args)
        # print(function_name, function_args)

        # Add the assistant response and function response to the messages
        messages.append({
            "role": response_message["role"],
            "function_call": {
                "name": function_name,
                "arguments": response_message["function_call"]["arguments"],
            },
            "content": None
        })

        if function_to_call == get_product_information:
            product_info = json.loads(function_response)
            # show product information after search for a different product that the current one
            # if product_info['product_image_file'] != current_product_image:

            # Note: APP can't issue token for blob storage in my tenant, so we need to remove the image_url from the response
            if use_app_registration == "true":
                products = {
                    "content": product_info['content'],
                    "image_url": "", 
                }
            else:
                products = [display_product_info(product_info)]
            

            # current_product_image = product_info['product_image_file']
            
            # return only product description to LLM to avoid chatting about prices and image files 
            # function_response = product_info['description']
            function_response = product_info['content']

        messages.append({
            "role": "function",
            "name": function_name,
            "content": function_response,
        })
     
        response = chat_complete(messages, functions= functions, function_call= "none")
        
        response_message = response["choices"][0]["message"]

    messages.append({'role' : response_message['role'], 'content' : response_message['content']})

    logging.info(json.dumps(response_message))

    response_object = {
        "messages": messages,
        "products": products
    }

    return func.HttpResponse(
        json.dumps(response_object),
        status_code=200
    )


def display_product_info(product_info, display_size=40):
    """ Display product information """
    from azure.identity import DefaultAzureCredential
    from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
    from datetime import datetime, timedelta
    import requests

    # 設置你的 Azure Blob Storage 資訊
    account_url = "https://aoaipaytonstr.blob.core.windows.net"
    container_name = "gov-images"

    # 使用 DefaultAzureCredential 進行身份驗證
    credential = DefaultAzureCredential()
    blob_service_client = BlobServiceClient(account_url=account_url, credential=credential)

    image_file = product_info['product_image_file']

    # 生成圖像 URL
    blob_client = blob_service_client.get_blob_client(container=container_name, blob=image_file)
    
    # 獲取用戶委派密鑰
    user_delegation_key = blob_service_client.get_user_delegation_key(
        key_start_time=datetime.utcnow(),
        key_expiry_time=datetime.utcnow() + timedelta(hours=1)
    )

    # 生成具有讀取權限的 SAS URL
    sas_token = generate_blob_sas(
        account_name=blob_service_client.account_name,
        container_name=container_name,
        blob_name=image_file,
        user_delegation_key=user_delegation_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.utcnow() + timedelta(hours=1)  # 設置過期時間
    )

    image_url = f"{blob_client.url}?{sas_token}"

    # image_url = blob_client.url

    response = requests.get(image_url)
    print("image_url: ", image_url)

    # Show image
    # image_file = product_info['product_image_file']

    # image_url = blob_sas_url.split("?")[0] + f"/{image_file}?" + blob_sas_url.split("?")[1]

    # response = requests.get(image_url)
    # print(image_url)

    # Check if the request was successful
    if response.status_code == 200:
        return {
            "content": product_info['content'],
            "image_url": image_url 
            }
    else:
        print(f"Failed to retrieve image. HTTP Status code: {response.status_code}")
    print(f"""{product_info['content']}""")

def generate_embeddings(text):
    """ Generate embeddings for an input string using embeddings API """

    url = f"{AOAI_endpoint}/openai/deployments/{embeddings_deployment}/embeddings?api-version={AOAI_api_version}"

    headers = {
        "Content-Type": "application/json",
        "api-key": AOAI_key,
    }

    data = {"input": text}

    response = requests.post(url, headers=headers, data=json.dumps(data)).json()
    return response['data'][0]['embedding']

def get_product_information(user_question, categories='*', top_k=1):
    """ Vectorize user query to search Cognitive Search vector search on index_name. Optional filter on categories field. """
     
    url = f"{search_endpoint}/indexes/{search_index_name}/docs/search?api-version={search_api_version}"

    headers = {
        "Content-Type": "application/json",
        "api-key": f"{search_key}",
    }
    
    vector = generate_embeddings(user_question)

    data = {
        "vectors": [
            {
                "value": vector,
                "fields": "content_vector",
                "k": top_k
            },
        ],
        "select": "content, product_image_file",
    }

    results = requests.post(url, headers=headers, data=json.dumps(data))    
    results_json = results.json()
    
    # Extracting the required fields from the results JSON
    product_data = results_json['value'][0] # hard limit to top result for now

    response_data = {
        "content": product_data.get('content'),
        "product_image_file": product_data.get('product_image_file'),
    }
    return json.dumps(response_data)

def chat_complete(messages, functions, function_call='auto'):
    """  Return assistant chat response based on user query. Assumes existing list of messages """
    
    url = f"{AOAI_endpoint}/openai/deployments/{chat_deployment}/chat/completions?api-version={AOAI_api_version}"

    headers = {
        "Content-Type": "application/json",
        "api-key": AOAI_key
    }

    data = {
        "messages": messages,
        "functions": functions,
        "function_call": function_call,
        "temperature" : 0,
    }

    response = requests.post(url, headers=headers, data=json.dumps(data)).json()

    return response
