# Shop Easily Using Talking Avatar - Trailblazers Outdoor Gear
<img src="./img/00-demo-screenshot.png" alt="drawing" style="width:1200px;"/>

This solution accelerator can be used to deploy an application that offers an interactive shopping experience using a talking avatar. It uses Azure OpenAI combined with data stored on Cognitive Search and Azure SQL to generate answers.
</br> 這個解決方案加速器可以部署一個應用程式，該應用程式利用會說話的虛擬人偶來提供互動式購物體驗。它結合了 Azure OpenAI、認知搜索以及存儲在 Azure SQL 上的數據來生成答案。

### Table of Contents

1. **[Getting Started](#getting-started)**
    - [Step 1. Prepare Environments](#step-1-prepare-environments)
    - [Step 2. Set Up Configurations and Upload Data](#step-2-set-up-configurations-and-upload-data)
    - [Step 3. Deploy Static Web App](#step-3-deploy-static-web-app)

1. **[Notes on Running the Solution Locally](#notes-on-running-the-solution-locally-在本地運行解決方案的注意事項)**

1. **[Hints on Debugging](#hints-on-debugging)**

## Getting Started

### Step 1. Prepare Environments
1. Start by forking this repo.
</br> 首先 fork 這個倉庫。
2. Create the following Azure resources:
</br> 建立以下 Azure 資源：
    - Azure OpenAI Service with these models deployed
    </br> 部署了這些模型的 Azure OpenAI 服務
      - gpt-35-turbo (note: **version 0613 or higher is required**)
        - You could use gpt-4o to improve the quality
         </br> 您可以使用 gpt-4o 來提高品質
      - text-embedding-ada-002 (version 2)
   - Azure AI Search with default settings
     </br> 使用預設設置的 Azure AI 搜索
   - Azure SQL Database and Azure SQL Server with the following settings
     </br> 設置符合以下設定的 Azure SQL Database 和 Azure SQL Server 
     - Authentication: SQL and Microsoft Entra authentication enabled
       </br> 身份驗證：已啟用 SQL 和 Microsoft Entra 身份驗證
     - Networking: Allow Azure services and resources to access this server enabled
       </br> 網路：允許 Azure 服務和資源存取此伺服器已啟用
     - You can refer to the instructions below to create SQL Database and SQL Server:
       </br> 您可以依照下列步驟建立符合條件的 SQL Database 和 SQL Server：
         <img src="./img/01-create-sql-database-server.png" alt="drawing" style="width:800px;"/> \
         <img src="./img/02-select-authentication-method.png" alt="drawing" style="width:600px;"/> \
         <img src="./img/03-set-networking.png" alt="drawing" style="width:600px;"/>
     
   - Azure Speech Service
     - Avatar only available in these regions: West US 2, West Europe, Southeast Asia, South Central US, Sweden Central, North Europe
       </br> Avatar 僅在以下區域可用：美國西部 2、西歐、東南亞、美國中南部、瑞典中部、北歐
     - Plan must be S0
       </br> 計劃必須為 S0
   - Azure AI services multi-service account
     </br> Azure AI 服務多服務帳戶
   - Azure Blob Storage account
     </br> Azure Blob 儲存帳戶

### Step 2. Set Up Configurations and Upload Data
1. Upload the images in the `product-images` directory to a blob container in the Storage Account. Right click the blob container to generate a **SAS URL** for the blob storage container. Set the expiry date according to the planned lifecycle of your application.
</br> 將 `product-images` 目錄中的圖像上傳到存儲帳戶中的 blob 容器。右鍵按下 blob 儲存容器為 blob 儲存容器生成 SAS URL。根據應用程式的生命週期規劃設定到期時間。</br>
    <img src="./img/04-generate-sas-uri.png" alt="drawing" style="width:600px;"/> \
    <img src="./img/09-SAS-dialog.png" alt="drawing" style="width:400px;"/>
    
2. Create a file named `local.settings.json` in the `api` directory of the repository. Make sure to add the following variables to `local.settings.json`. The `AzureWebJobsStorage` variable can be left empty for development purposes.
</br> 在倉庫的 api 目錄中創建一個名為 `local.settings.json` 的檔。確保將以下變數添加到`local.settings.json`。出於開發目的，可以將 `AzureWebJobsStorage` 變數留空。
    ```
    {
      "IsEncrypted": false,
      "Values": {
        "AzureWebJobsStorage": "",
        "FUNCTIONS_WORKER_RUNTIME": "python",
        "AZURE_OPENAI_ENDPOINT": "https://XXX.openai.azure.com/",
        "AZURE_OPENAI_API_KEY": "XXX",
        "AZURE_OPENAI_CHAT_DEPLOYMENT" : "XXX",
        "AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT" : "text-embedding-ada-002",
        "AZURE_OPENAI_API_VERSION" : "XXX",
        "AZURE_SEARCH_ENDPOINT": "https://XXX.search.windows.net",
        "AZURE_SEARCH_API_KEY": "XXX",
        "AZURE_SEARCH_INDEX": "products",
        "AZURE_SPEECH_REGION": "XXX",
        "AZURE_SPEECH_API_KEY": "XXX",
        "TEXT_ANALYTICS_ENDPOINT": "XXX",
        "TEXT_ANALYTICS_KEY": "XXX",
        "BLOB_SAS_URL": "https://XXX",
        "SQL_DB_SERVER": "XXX.database.windows.net",
        "SQL_DB_USER": "XXX",
        "SQL_DB_PASSWORD": "XXX",
        "SQL_DB_NAME": "XXX"
      }
    }
    ```
  - For ``AzureWebJobsStorage``, leave empty
  </br> 對於 AzureWebJobsStorage，請留空。
  - For ``AZURE_OPENAI_ENDPOINT``, ``AZURE_OPENAI_API_KEY``, and ``AZURE_OPENAI_CHAT_DEPLOYMENT``, please reference here
    ![image](https://github.com/user-attachments/assets/8ef8898b-c535-45d6-a63b-84df1256f2f9)
  - For ``AZURE_SEARCH_ENDPOINT`` and ``AZURE_SEARCH_API_KEY``, please reference here
    ![image](https://github.com/user-attachments/assets/97608568-feac-4185-b835-5635c95e93de)
    ![image](https://github.com/user-attachments/assets/7079805a-9d63-4ff0-a6c9-ee12a51b97ad)
  - For ``AZURE_SPEECH_REGION`` and ``AZURE_SPEECH_API_KEY``, please reference here
    ![image](https://github.com/user-attachments/assets/e0c87363-a54f-45e3-bf53-22279c44fc7f)
     - Avatar only available in these regions: West US 2, West Europe, Southeast Asia, South Central US, Sweden Central, North Europe
     </br> Avatar 僅在以下區域可用：美國西部 2、西歐、東南亞、美國中南部、瑞典中部、北歐
     - Plan must be S0
     </br> 計劃必須為 S0
    
  - For ``TEXT_ANALYTICS_ENDPOINT`` and ``TEXT_ANALYTICS_KEY``, please reference here
    ![image](https://github.com/user-attachments/assets/c56aa1de-c0a0-420a-998e-5ea18fbae2c7)
  - For ``BLOB_SAS_URL``, please reference here
    ![image](https://github.com/user-attachments/assets/e8dd21ea-10fb-484a-9a19-6714004b5fe5)
  - For ``SQL_DB_SERVER``, ``SQL_DB_NAME`` and ``SQL_DB_USER``, please reference here
    ![image](https://github.com/user-attachments/assets/4ad1c1b3-a349-463f-894a-6a5d8d987155)

3. Run the cells in the `create-index-and-database.ipynb` notebook to upload the product data to Azure AI Search and the Azure SQL Database.
</br> 運行 `create-index-and-database.ipynb` 筆記本中的儲存格，將產品數據上傳到 Azure AI 搜索和 Azure SQL 資料庫。
   - When you are testing connection to the SQL Server, if you receive error message saying that *Azure Active Directory only authentication is enabled. Please contact your system administrator*, please disable Microsoft Entra authentication only in your SQL server.
     </br> 當您嘗試連接到 SQL Server 時，如果收到錯誤消息顯示 *Azure Active Directory only authentication is enabled. Please contact your system administrator*，請在您的 SQL Server 中停用僅限 Microsoft Entra 身份驗證。
     <img src="./img/05-enable-sql-authentication.png" alt="drawing" style="width:600px;"/>

   - When you are testing connection to the SQL Server, if you receive error message saying that *Cannot open server 'YOUR_SERVER' requested by the login. Client with IP address 'YOUR_IP_ADDRESS' is not allowed to access the server*, please add your current IP address to your SQL server.
     </br> 當您嘗試連接到 SQL Server 時，如果收到錯誤消息顯示 *Cannot open server 'YOUR_SERVER' requested by the login. Client with IP address 'YOUR_IP_ADDRESS' is not allowed to access the server*，請將您目前的 IP 位置新增到 SQL Server。
     <img src="./img/06-add-ip-address.png" alt="drawing" style="width:600px;"/>

### Step 3. Deploy Static Web App
1. In case you are using an Azure Speech Services instance in a region different from `westeurope`, update line 17 of `main.js` in the `src/js` folder to reflect that.
   </br> 如果你在與 `westeurope` 不同的區域中使用 Azure 語音服務實例，請更新 `src/js` 資料夾中的 `main.js` 的第 17 行以反映這一點。
   <img src="./img/07-change-region.png" alt="drawing" style="width:600px;"/>
2. This application can be deployed using Azure Static Web Apps. Refer to this [quickstart](https://docs.microsoft.com/azure/static-web-apps/getting-started?tabs=vanilla-javascript) to learn more. This application is using no front-end frameworks. If you are using **Visual Studio Code**, you can execute the following steps:
</br> 此應用程式可以使用 Azure Static Web Apps 進行部署。請參閱此快速入門以瞭解更多資訊。此應用程式未使用前端框架。 如果您使用的是 Visual Studio Code，則可以執行以下步驟：</br> 
    - Install  the Azure Static Web Apps and Azure Functions extensions.
      </br> 安裝 Azure Static Web Apps 和 Azure Functions 擴展。
    - Open Azure extension, select your subscription, and right-click on Static Web Apps extension folder, select **Create Static Web App ... (Advanced)**
      </br> 右鍵按下 Static Web Apps 擴展資料夾，選擇“創建 Static Web App...（進階）”。
      <img src="./img/08-create-static-web-app.png" alt="drawing" style="width:600px;"/>
    - Create Static Web App with the following parameters:
      </br> 使用以下參數創建 Static Web App：
      | Parameter  參數            | Description 描述                                                 |
      |---------------------------|------------------------------------------------------------------|
      | Resource group            | Select an existing resource group or create a new one 選擇現有資源組或創建新資源組           |
      | Name                      | Choose a name, e.g., avatar-app                                  |
      | Pricing option            | Standard                                                         |
      | Region                    | Select the same or a nearby region as for the above resources 選擇與上述資源相同或附近的區域   |
      | Framework                 | Custom                                                           |
      | Application code location | avatar/interactive/src                                           |
      | Build output location     | (Leave blank)                                                    |      
    - It will create an workflow to deploy from GitHub Action to Static Web App without config yet.
      Here are my sample workflow config and my sample running result for your reference:
      </br> 它將創建一個工作流，無需配置即可從 GitHub Action 部署到 Static Web App。我的範例工作流配置與運行結果供您參考：
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
        ![image](https://github.com/user-attachments/assets/90c76ce1-fac8-4dd7-86fa-32d367bee575)
3.  In the VSCode Static Web Apps extension, navigate to **Application Settings** of your app and right-click **Upload Local Settings**. This will populate the settings from `local.settings.json` to the web app. You can verify if the environment variables are correct via Azure portal.
    </br> 在 VSCode 的 Static Web Apps 擴展中，前往「應用程式設置」，然後在「上傳本地設置」上點擊右鍵兩次。這會將 `local.settings.json` 文件中的設置上傳至 Web 應用程式。從 VS Code 上傳本地設置後，您可以在 Azure 上看到 Static Web Apps Config。
    ![image](https://github.com/user-attachments/assets/e0c3190a-d1eb-4f7d-8397-fbeae08bf372)
    ![image](https://github.com/user-attachments/assets/8bfdfc69-b134-49fd-aa41-6cdb59fe2175)

4. In the VSCode Static Web Apps extension, right-click on your app name and select **Browse site** to use the app.
   </br> 在 VSCode Static Web Apps 擴展中，右鍵按兩下應用名稱，然後選擇「瀏覽網站」以使用此應用。
   <img src="./img/17-browse-site.png" alt="drawing" style="width:600px;"/>
   
## Notes on Running the Solution Locally 在本地運行解決方案的注意事項
- ODBC Driver 17 for SQL Server is required to run the solution locally. You can install it via this [link](https://learn.microsoft.com/zh-tw/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16#version-17).
    </br> 需要 ODBC Driver 17 for SQL Server 才能在本地運行解決方案。您可以透過此連結安裝。
- The solution has been tested with Node version 18.0.0.
  </br> 此解決方案已使用 Node 版本 18.0.0 進行了測試。
- To run the solution locally, please follow the instructions below:
  </br> 請依照下列步驟在本地運行此解決方案：
  - We use Use the Static Web Apps CLI to run the solution. You can install it via npm. Details can be found [here](https://azure.github.io/static-web-apps-cli/docs/use/install/).
    </br> 我們使用 Static Web Apps CLI 來運行此解決方案。您可以透過 npm 安裝它，詳細說明可參照此連結。
      ```
      npm install -g @azure/static-web-apps-cli
      swa --version
      ```
  - Create your Python environment and install the necessary dependencies. For our development, we utilized virtualenv and the running environment is Python 3.11. You can do the same with these commands:
    </br> 創建您的 Python 虛擬環境，並安裝必要的套件。我們以 virtualenv 創建 Python 3.11 的環境。您可以依照以下指令創建環境：
      ```
        # pip install virtualenv
        $ virtualenv -p python3.11 myenv
        $ source ./myenv/bin/activate
        $ python --version
        $ pip install -r requirements.txt
      ```
  - After navigating in the terminal to `avatar/interactive`, the following command can be used to run the solution. Once succeed, you will see the output on console.
    </br> 將您的終端機切換到 `avatar/interactive` 目錄後，執行以下指令即可運行解決方案。若成功運行，您可以在終端機看到運行結果。
    ```
    swa start src --api-location api
    ```
    ![image](https://github.com/user-attachments/assets/c72def24-87ff-4c47-bfdb-b497eccf017c)

## Hints on Debugging

- The login screen is currently non-functional. If you click on 'login' without entering any information, you will be redirected to the main page.
  </br> 登錄螢幕目前無法正常工作。如果您點擊「登錄」而不輸入任何資訊，您將被重定向到主頁。
- If the avatar is not loading on the main page, refresh the web page with the console open. This will show the error message.
  </br> 如果 avatar 未在主頁上載入，請在主頁打開的情況下刷新網頁。這將顯示錯誤消息。
- When you see an error message saying *Failed to load resource: the server responded with a status of 404 (/favicon.ico:1)*, you may try cleaning your cache to fix this issue.
  </br> 當您看到錯誤訊息顯示 *Failed to load resource: the server responded with a status of 404 (/favicon.ico:1)* 時，請嘗試清除快取以修正此問題。
- You can open console to further deal with your bugs.
  </br> 您可以打開開發人員工具已處理更多可能的錯誤。
  ![image](https://github.com/user-attachments/assets/f7cd0370-19b5-4180-acbd-62c63799d961)
  ![image](https://github.com/user-attachments/assets/4f5e7af7-38a8-4794-a77a-1e55bce16d25)
