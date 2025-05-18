const express = require('express');
const fetch = require('node-fetch'); // Using node-fetch v2 for CommonJS
const cors = require('cors');
const { GoogleAuth } = require('google-auth-library');

const app = express();

// Configure CORS: Allow requests from your frontend development server and deployed URL
const corsOptions = {
  origin: ['http://localhost:3000', 'https://gcp-onboarder-example.web.app'],
  methods: ['POST', 'OPTIONS'], // Allow POST and OPTIONS for preflight
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json()); // Middleware to parse JSON bodies

// Pre-flight requests
app.options('/linkBilling', cors(corsOptions));
app.options('/getIamPolicy', cors(corsOptions));

// Endpoint to fetch IAM policy (useful for debugging)
app.post('/getIamPolicy', async (req, res) => {
  console.log('Received request to /getIamPolicy');

  const { billingAccountName } = req.body;
  const authHeader = req.headers.authorization;

  if (!billingAccountName) {
    console.error('Missing billingAccountName in request body');
    return res.status(400).send('Missing billingAccountName.');
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Missing or invalid Authorization header');
    return res.status(401).send('Unauthorized: Missing or invalid Authorization header.');
  }

  const accessToken = authHeader.split(' ')[1];
  if (!accessToken) {
    console.error('Access token is empty');
    return res.status(401).send('Unauthorized: Access token is empty.');
  }

  console.log(`Attempting to get IAM policy for billing account ${billingAccountName}`);
  console.log(`Using access token (first 10 chars): ${accessToken.substring(0, 10)}...`);

  const iamPolicyUrl = `https://cloudbilling.googleapis.com/v1/${billingAccountName}:getIamPolicy`;

  try {
    const iamPolicyResponse = await fetch(iamPolicyUrl, {
      method: 'POST', // getIamPolicy uses POST with empty body
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}) // Empty body is required
    });

    const responseBody = await iamPolicyResponse.text();
    console.log(`IAM Policy API response status: ${iamPolicyResponse.status}`);
    console.log(`IAM Policy API response body: ${responseBody}`);

    if (!iamPolicyResponse.ok) {
      let errorDetails = responseBody;
      try {
        errorDetails = JSON.parse(responseBody);
      } catch (e) { /* ignore if not JSON */ }
      
      console.error('IAM Policy API call failed.');
      return res.status(iamPolicyResponse.status).json({
        message: `Failed to get IAM policy. Status: ${iamPolicyResponse.status}`,
        details: errorDetails,
      });
    }

    // Successfully got IAM policy, extract admin members
    const policy = JSON.parse(responseBody);
    console.log('Successfully fetched IAM policy');
    
    // Find billing admin role bindings
    let adminMembers = [];
    if (policy.bindings) {
      for (const binding of policy.bindings) {
        if (binding.role === 'roles/billing.admin' || binding.role === 'roles/billing.administrator') {
          adminMembers = adminMembers.concat(binding.members);
        }
      }
    }
    
    console.log('Billing Admin members from policy:', adminMembers);
    
    // Return the full policy and extracted admin members
    res.status(200).json({
      policy: policy,
      billingAdminMembers: adminMembers
    });

  } catch (error) {
    console.error('Error during IAM policy fetch:', error);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
});

// Main function endpoint to link billing account
app.post('/linkBilling', async (req, res) => {
  console.log('Received request to /linkBilling');

  const { projectId, billingAccountName } = req.body;
  const authHeader = req.headers.authorization;

  if (!projectId || !billingAccountName) {
    console.error('Missing projectId or billingAccountName in request body');
    return res.status(400).send('Missing projectId or billingAccountName.');
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Missing or invalid Authorization header');
    return res.status(401).send('Unauthorized: Missing or invalid Authorization header.');
  }

  const accessToken = authHeader.split(' ')[1];
  if (!accessToken) {
    console.error('Access token is empty');
    return res.status(401).send('Unauthorized: Access token is empty.');
  }

  console.log(`Attempting to link project ${projectId} to billing account ${billingAccountName}`);
  console.log(`Using access token (first 10 chars): ${accessToken.substring(0, 10)}...`);

  const billingApiUrl = `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`;
  const requestBody = {
    billingAccountName: billingAccountName,
    billingEnabled: true
  };

  try {
    // Get IAM policy first for debugging purposes
    try {
      const iamPolicyUrl = `https://cloudbilling.googleapis.com/v1/${billingAccountName}:getIamPolicy`;
      const iamPolicyResponse = await fetch(iamPolicyUrl, {
        method: 'POST', // getIamPolicy for billing accounts uses POST
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}) // Empty body
      });
      if (iamPolicyResponse.ok) {
        const policy = await iamPolicyResponse.json();
        console.log('Successfully fetched IAM policy for debugging purposes');
        const adminBinding = policy.bindings.find(b => b.role === 'roles/billing.admin' || b.role === 'roles/billing.administrator');
        if (adminBinding) {
          console.log('Billing Admin members from policy:', adminBinding.members);
        }
      } else {
        console.warn(`Failed to fetch IAM policy for debugging: ${iamPolicyResponse.status} ${await iamPolicyResponse.text()}`);
      }
    } catch (iamError) {
      console.warn('Error fetching IAM policy for debugging:', iamError);
    }

    // Now perform the actual billing linkage
    const response = await fetch(billingApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseBody = await response.text(); // Read as text first for better error logging
    console.log(`Billing API response status: ${response.status}`);
    console.log(`Billing API response body: ${responseBody}`);

    if (!response.ok) {
      // Try to parse as JSON if it's an error, otherwise send the text
      let errorDetails = responseBody;
      try {
        errorDetails = JSON.parse(responseBody);
      } catch (e) { /* ignore if not JSON */ }
      
      console.error('Billing API call failed.');
      return res.status(response.status).json({
        message: `Failed to link billing account. Status: ${response.status}`,
        details: errorDetails,
      });
    }

    console.log('Successfully linked billing account.');
    // The API returns the updated billingInfo on success
    res.status(200).json(JSON.parse(responseBody));

  } catch (error) {
    console.error('Error during billing linkage process:', error);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
});

// Export the Express app for Google Cloud Functions
exports.linkBillingHandler = app;

// For local testing (uncomment to test locally)
// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () => {
//   console.log(`Server listening on port ${PORT}...`);
// });
