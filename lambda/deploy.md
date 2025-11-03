# AWS Lambda デプロイ手順

## 前提条件
- AWS CLI がインストール・設定済み
- AWS SAM CLI がインストール済み
- 適切なIAM権限を持つAWSアカウント

## デプロイ手順

### 1. AWS SAM CLI のインストール
```bash
# Windows (Chocolatey)
choco install aws-sam-cli

# または公式インストーラーを使用
# https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html
```

### 2. AWS認証情報の設定
```bash
aws configure
# Access Key ID, Secret Access Key, Region を入力
```

### 3. Lambda関数のデプロイ
```bash
cd lambda
sam build
sam deploy --guided
```

### 4. 初回デプロイ時の設定
- Stack Name: `household-budget-app`
- AWS Region: `ap-northeast-1` (東京リージョン)
- Confirm changes before deploy: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save parameters to samconfig.toml: `Y`

### 5. API Gateway URLの確認
デプロイ完了後、出力されるAPI Gateway URLを `.env` ファイルに設定

### 6. フロントエンドの環境変数設定
```bash
# プロジェクトルートで
cp .env.example .env
# .env ファイルを編集してAPI URLを設定
```

## トラブルシューティング

### DynamoDBテーブルが作成されない場合
- IAM権限を確認
- リージョンが正しく設定されているか確認

### CORS エラーが発生する場合
- Lambda関数のレスポンスヘッダーを確認
- API Gateway の CORS 設定を確認