#!/bin/bash

# Make this script executable by running: chmod +x deploy.sh

# Set your GCP project ID - replace with your actual project ID
PROJECT_ID="gemini-med-lit-review"  # Change this to your project ID

# Set the region for your cloud function
REGION="us-central1"  # You can change this to your preferred region

# Set the function name
FUNCTION_NAME="performBillingLinkage"

# Set the runtime
RUNTIME="nodejs18"

# Set memory allocation (MB)
MEMORY="256MB"

# Set maximum number of instances
MAX_INSTANCES="10"

# Display deployment info
echo "Deploying Cloud Function with the following settings:"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Function Name: $FUNCTION_NAME"
echo "Runtime: $RUNTIME"
echo "Memory: $MEMORY"
echo "Max Instances: $MAX_INSTANCES"
echo ""

# Deploy the function
echo "Deploying Cloud Function..."
gcloud functions deploy $FUNCTION_NAME \
  --project=$PROJECT_ID \
  --region=$REGION \
  --runtime=$RUNTIME \
  --memory=$MEMORY \
  --max-instances=$MAX_INSTANCES \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point=linkBillingHandler

# Check if the deployment was successful
if [ $? -eq 0 ]; then
  echo "Deployment successful!"
  
  # Get the function URL
  URL=$(gcloud functions describe $FUNCTION_NAME --region=$REGION --format="value(httpsTrigger.url)")
  echo ""
  echo "Function URL: $URL"
  echo ""
  echo "You can test the function with:"
  echo "curl -X POST $URL/getIamPolicy \\"
  echo "  -H \"Content-Type: application/json\" \\"
  echo "  -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" \\"
  echo "  -d '{\"billingAccountName\": \"billingAccounts/01F96D-4A5D23-BDC963\"}'"
  echo ""
  echo "Don't forget to update the frontend API calls in src/services/billing.ts"
else
  echo "Deployment failed."
fi
