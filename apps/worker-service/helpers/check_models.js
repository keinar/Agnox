// check_models.js
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function check() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  try {
    const result = await model.generateContent("Hello, are you working?");
    console.log("Success! Response:", result.response.text());
  } catch (error) {
    console.error("Error details:", error.message);
  }
}

check();