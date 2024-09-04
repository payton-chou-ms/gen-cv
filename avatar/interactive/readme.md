# Shop Easily Using Talking Avatar - Trailblazers Outdoor Gear

<img src="./demo-screenshot.png" alt="drawing" style="width:1200px;"/>

This solution accelerator can be used to deploy an application that offers an interactive shopping experience using a talking avatar. It uses Azure OpenAI combined with data stored on Cognitive Search and Azure SQL to generate answers.

## Getting started

1. Start by forking this repo 

2. Create the following Azure resources:
    - Azure OpenAI Service with these models deployed
      - gpt-35-turbo (note: **version 0613 or higher is required**)
        - Note: You could use gpt-4o to improve the quality
      - text-embedding-ada-002 (version 2)
   - Azure AI Search with default settings
   - Azure SQL with the following settings
     - Authentication: SQL and Microsoft Entra authentication enabled
     - Networking: Allow Azure services and resources to access this server enabled
   - Azure Speech Service
     - Note: Avatar only available in these regions: West US 2, West Europe, Southeast Asia, South Central US, Sweden Central, North Europe
     - Note: Plan must be S0
   - Azure AI services multi-service account
   - Azure Blob Storage account

3. Upload the images in the `product-images` directory to a blob container in the Storage Account. Generate a **SAS URL** for the blob storage container. Set the expiry date according to the planned lifecycle of your application.

    <img src="./SAS-dialog.png" alt="drawing" style="width:400px;"/>

4. Run the cells in the `create-index-and-database.ipynb` notebook to upload the product data to Azure AI Search and the Azure SQL Database.

5. Create a file named `local.settings.json` in the `api` directory of the repository. Make sure to add the following variables to `local.settings.json`. The `AzureWebJobsStorage` variable can be left empty for development purposes.

```
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AZURE_OPENAI_ENDPOINT": "https://XXX.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "XXX",
    "AZURE_OPENAI_CHAT_DEPLOYMENT" : "gpt-35-turbo-16k",
    "AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT" : "text-embedding-ada-002",
    "AZURE_OPENAI_API_VERSION" : "2023-07-01-preview",
    "AZURE_SEARCH_ENDPOINT": "https://XXX.search.windows.net",
    "AZURE_SEARCH_API_KEY": "XXX",
    "AZURE_SEARCH_INDEX": "products",
    "AZURE_SPEECH_REGION": "westeurope",
    "AZURE_SPEECH_API_KEY": "XXX",
    "TEXT_ANALYTICS_ENDPOINT": "XXX",
    "TEXT_ANALYTICS_KEY": "XXX",
    "BLOB_SAS_URL": "https://XXX",
    "SQL_DB_SERVER": "XXX.database.windows.net",
    "SQL_DB_USER": "XXX",
    "SQL_DB_PASSWORD": "XXX",
    "SQL_DB_NAME": "OutdoorEquipmentShop"
  }
}
```
- Note:
  - For AzureWebJobsStorage, leave empty
  - For AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_CHAT_DEPLOYMENT, please reference here
    - ![image](https://github.com/user-attachments/assets/8ef8898b-c535-45d6-a63b-84df1256f2f9)
  - For AZURE_SEARCH_ENDPOIN, AZURE_SEARCH_API_KEY, please reference here
    - ![image](https://github.com/user-attachments/assets/97608568-feac-4185-b835-5635c95e93de)
    - ![image](https://github.com/user-attachments/assets/7079805a-9d63-4ff0-a6c9-ee12a51b97ad)
  - For AZURE_SPEECH_REGION, AZURE_SPEECH_API_KEY
     - Note: Avatar only available in these regions: West US 2, West Europe, Southeast Asia, South Central US, Sweden Central, North Europe
     - Note: Plan must be S0
    - ![image](https://github.com/user-attachments/assets/e0c87363-a54f-45e3-bf53-22279c44fc7f)
  - For TEXT_ANALYTICS_ENDPOINT and TEXT_ANALYTICS_KEY, please reference here
    - ![image](https://github.com/user-attachments/assets/c56aa1de-c0a0-420a-998e-5ea18fbae2c7)
  - For BLOB_SAS_URL
    - ![image](https://github.com/user-attachments/assets/e8dd21ea-10fb-484a-9a19-6714004b5fe5)
  - For SQL_DB_SERVER and SQL_DB_USER
    - ![image](https://github.com/user-attachments/assets/4ad1c1b3-a349-463f-894a-6a5d8d987155)
6. In case you are using an Azure Speech Services instance in a region different from `westeurope`, update line 17 of `main.js` in the `src/js` folder to reflect that.
   Also change the code in line 277 of `main.js` in the `src/js` folder.
7. This application can be deployed using Azure Static Web Apps. Refer to this [quickstart](https://docs.microsoft.com/azure/static-web-apps/getting-started?tabs=vanilla-javascript) to learn more. This application is using no front-end frameworks.

    If you are using **Visual Studio Code**, you can execute the following steps:
    - Install  the Azure Static Web Apps and Azure Functions extensions
    - Right-click on Static Web Apps extension folder, select **Create Static Web App ... (Advanced)** with the following parameters:  

      | Parameter                 | Description                                                      |
      |---------------------------|------------------------------------------------------------------|
      | Resource group            | Select an existing resource group or create a new one            |
      | Name                      | Choose a name, e.g., avatar-app                                  |
      | Pricing option            | Standard                                                         |
      | Region                    | Select the same or a nearby region as for the above resources    |
      | Framework                 | Custom                                                           |
      | Application code location | avatar/interactive/src                                           |
      | Build output location     | (Leave blank)                                                    |      
    - Note: It will create an workflow to deploy from GitHub Action to Static Web App without config yet.
      My sample workflow config paste here for your reference:
```
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true
          lfs: false
      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_CALM_ISLAND_0683BD41E }}
          repo_token: ${{ secrets.GITHUB_TOKEN }} # Used for Github integrations (i.e. PR comments)
          action: "upload"
          ###### Repository/Build Configurations - These values can be configured to match your app requirements. ######
          # For more information regarding Static Web App workflow configurations, please visit: https://aka.ms/swaworkflowconfig
          app_location: "/avatar/interactive/src" # App source code path
          api_location: "/avatar/interactive/api" # Api source code path - optional
          output_location: "" # Built app content directory - optional
          ###### End of Repository/Build Configurations ######

  close_pull_request_job:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request Job
    steps:
      - name: Close Pull Request
        id: closepullrequest
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_CALM_ISLAND_0683BD41E }}
          action: "close"
```
  - My sample running result
    - ![image](https://github.com/user-attachments/assets/90c76ce1-fac8-4dd7-86fa-32d367bee575)
8. In the VSCode Static Web Apps extension, navigate to **Application Settings** of your app and right-click **Upload Local Settings**. This will populate the settings from `local.settings.json` to the web app.
- Once you upload Local Settings from VS Code, you will see Static Web Apps Config
  - ![image](https://github.com/user-attachments/assets/e0c3190a-d1eb-4f7d-8397-fbeae08bf372)
  - ![image](https://github.com/user-attachments/assets/8bfdfc69-b134-49fd-aa41-6cdb59fe2175)

8. In the VSCode Static Web Apps extension, right-click on your app name and select **Browse site** to use the app

## Notes on running the solution locally

- ODBC Driver 17 for SQL Server is required to run the solution locally.
  - Note: Install here: https://learn.microsoft.com/zh-tw/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16#download-for-windows
- Note: My running environment is python 3.11, please switch your python virtual environment
```
# pip install virtualenv
$ virtualenv -p python3.11 myenv
$ source ./myenv/bin/activate
$ python --version
$ pip install -r requirements.txt
```
- Use the Static Web Apps CLI to run the solution. After navigating in the terminal to `avatar/interactive`, the following command can be used to run the solution: `swa start src --api-location api`.
  - Note: Install by below command
```
npm install -g @azure/static-web-apps-cli
swa --version
```
- The solution has been tested with Node version 18.0.0.
  - Note: Sample console output
    - ![image](https://github.com/user-attachments/assets/c72def24-87ff-4c47-bfdb-b497eccf017c)
## Hints on debugging

- The login screen is currently non-functional. If you click on 'login' without entering any information, you will be redirected to the main page.
- If the avatar is not loading on the main page, refresh the web page with the console open. This will show the error message.
  - Debug Panel
    ![image](https://github.com/user-attachments/assets/f7cd0370-19b5-4180-acbd-62c63799d961)
  - Debug Console
    ![image](https://github.com/user-attachments/assets/4f5e7af7-38a8-4794-a77a-1e55bce16d25)
