const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const sendMessage = document.querySelector("#send-message");
const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
const fileCancelButton = fileUploadWrapper.querySelector("#file-cancel");
const chatbotToggler = document.querySelector("#chatbot-toggler");
const closeChatbot = document.querySelector("#close-chatbot");

// API setup
const API_KEY = "AIzaSyCdIFyEyQxUg6aX9SK6icPGhYoDBMlydp4";
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Initialize user message and file data
const userData = {
  message: null,
  file: {
    data: null,
    mime_type: null,
  },
};

function markdownToHtml(markdownText) {
  // 1. Links (with HTTP/HTTPS or WWW) and Markdown links [text](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s]+)\)|(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;

  let html = markdownText.replace(linkRegex, (match, linkText, url1, url2, url3) => {
    const url = url1 || url2 || (url3 ? "https://" + url3 : null); // Handle different link formats

    if (url) {
      const actualLinkText = linkText || url; // Use linkText if provided, otherwise use the URL itself
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${actualLinkText}</a>`;
    }
    return match; // Return the original match if no URL is found
  });


  // 2. Bold (**) and Underline (__)
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<u>$1</u>"); // Use <u> for underline

  // 3. Italics (*) and Emphasis (_)
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>"); // Or use <i> for italics

  // 4. Newlines (\n)
  html = html.replace(/\n/g, "<br>");

  return html;
}

// Store chat history
const initialInputHeight = messageInput.scrollHeight;

// Create message element with dynamic classes and return it
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

let chatHistory = [];

// Rate limiting variables
let requestQueue = [];
let isProcessing = false;

const processQueue = async () => {
    if (isProcessing || requestQueue.length === 0) {
        return;
    }

    isProcessing = true;
    const { incomingMessageDiv, geminiRequest } = requestQueue.shift(); // Get from queue

    try {
        const response = await fetch(API_URL, geminiRequest); // Use request from queue
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData?.error?.message || response.statusText;
            throw new Error(`API Error: ${response.status} - ${errorMessage}`);
        }

        const data = await response.json();
        const candidate = data.candidates && data.candidates.length > 0 ? data.candidates[0] : null;

        if (!candidate || !candidate.content || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
            throw new Error("Invalid API response: Missing or malformed data.");
        }

        const part = candidate.content.parts[0];
        if (!part.text) {
            throw new Error("Invalid API response: Missing 'text' field.");
        }

        const apiResponseText = markdownToHtml(part.text.trim());
        incomingMessageDiv.querySelector(".message-text").innerHTML = apiResponseText;

        chatHistory.push({
            role: "model",
            parts: [{ text: part.text }],
        });

    } catch (error) {
        console.error("API Error:", error);
        incomingMessageDiv.querySelector(".message-text").innerText = `Error: ${error.message}`;
        incomingMessageDiv.querySelector(".message-text").style.color = "red";
    } finally {
        incomingMessageDiv.classList.remove("thinking");
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
        isProcessing = false;
        processQueue(); // Process the next request
    }
};

const generateBotResponse = (incomingMessageDiv) => {

    const systemInstructions = `You are a helpful chat agent for Bupa health insurance in Australia. Your task is to provide help customers find the right Hospital and Extras cover for their situation. Always stick to health cover suggestions and health cover advice. If asked about anything unrelated to health insurance, politely redirect the conversation back to health insurance. Provide information on health insurance in a clear, simple way and ask questions on whether the hospital cover is for visa requirements, saving on tax, pregnancy, coming off another policy and switching to a new provider.\n\nDon't ask them more than one question at a time and only recommend products once you've asked them if they have a green or blue medicare card, have a corporate discount, and the number of people on the policy.\n\nAsk them if they are eligible for a corporate discount with Bupa through their employer and if they say yes, provide them this link to do a quote: https://www.bupa.com.au/corporate\n\nIf they need health cover for visa requirements, ask them if it's for working, holidaying or studying in Australia.\nIf they are working, provide them this link and mention they'll need to do a quote: https://www.bupa.com.au/health-insurance/overseas-visitors/working\nIf they are holidaying, provide them this link and mention they'll need to do a quote: https://www.bupa.com.au/health-insurance/overseas-visitors/working-and-holidaying\nIf they are studying, provide them this link and mention they'll need to do a quote: https://www.bupa.com.au/health-insurance/oshc\n\nGroup 1: Gold from $59.11 per week\nhttps://www.bupa.com.au/health-insurance/cover/gold-comprehensive-hospital\n- Pregnancy and birth\n- Assisted reproductive services\n- Weight loss surgery\n- Dialysis for chronic kidney failure\n- Hospital psychiatric services\n- As well as all other lower tier inclusions\n\nGroup 2: Silver Plus Advanced from $39.58 per week\nhttps://www.bupa.com.au/health-insurance/cover/silver-plus-advanced-hospital\n- Cataracts\n- Joint replacements\n- Insulin pumps\n- Pain management with device\n- As well as all other lower tier inclusions\n\nGroup 3: Silver Plus from $26.24 per week\nhttps://www.bupa.com.au/health-insurance/cover/silver-plus-essential-hospital\n- Palliative care\n- Rehabilitation\n- Heart and vascular system\n- Back, neck and spine\n- Plastic and reconstructive (medically necessary)\n- Implantation of hearing device\n- As well as all other lower tier inclusions\n\nGroup 4: Bronze Plus from $21.19 per week\nhttps://www.bupa.com.au/health-insurance/cover/bronze-plus-simple-hospital\n- Kidney and Bladder\n- Brain and nervous system\n- Blood\n- Chemotherapy, radiotherapy and immunotherapy for cancer\n- Eye (not cataracts)\n- Ear Nose and Throat\n- Bone, Joint, Muscle\n- Sleep Studies\n- Skin\n- Digestive System\n- Breast Surgery (Medically necessary)\n- Podiatric Surgery (provided be a registered podiatric surgeon)\n- Pain Management\n- Male Reproductive\n- Diabetes management (excluding insulin pumps)\n- As well as all other lower tier inclusions\n\nGroup 5: Basic Plus from $19.49 per week\nhttps://www.bupa.com.au/health-insurance/cover/basic-plus-starter-hospital\n- Joint reconstructions\n- Tonsils, adenoids, and grommets\n- Hernia and appendix\n- Gastrointestinal endoscopy\n- Gynaecology\n- Miscarriage and termination of pregnancy\n- Dental surgery\n- As well as all other lower tier inclusions\n\nGroup 6: Accident Only Hospital cover from $17.98 per week\nhttps://www.bupa.com.au/health-insurance/cover/basic-accident-only-hospital\n- For tax purposes (MLS)\n- Lifetime Health Cover purposes\n- Uncapped emergency ambulance\n- No other inclusions are in this tier\n\nExtras Saver from $2.79 per week\n- General Dental\n- Emergency Ambulance Services\n- No other inclusions in this tier\n\nFreedom 50 Extras from $3.47 per week\n- Physiotherapy\n- Chiropractic & Osteopathy\n- As well as all other lower tier inclusions\n\nStarter Extras from $5.62 per week\n- Remedial Massage\n- Optical\n- As well as all other lower tier inclusions\n\nFreedom 60 Extras from $7.99 per week\n- Remedial Massage\n- Optical\n- As well as all other lower tier inclusions\n\nCore Extras from $8.93 per week\n- Major Dental & Endodontic\n- Digital Mental Health\n- Acupuncture\n- Chinese Herbalism\n- Exercise Physiology\n- As well as all other lower tier inclusions\n\nFreedom 60 Boost Extras from $10.29 per week\n- Major Dental & Endodontic\n- Digital Mental Health\n- Acupuncture\n- Chinese Herbalism\n- Exercise Physiology\n- As well as all other lower tier inclusions\n\nWellness Extras from $12.14 per week\n- Orthodontic\n- Non PBS Pharmaceuticals\n- Dietary\n- Podiatry\n- Travel & Accommodation\n- As well as all other lower tier inclusions\n\nSuper Extras from $15.12 per week\n- Speech Therapy\n- Eye Therapy\n- Occupational Therapy\n- Home Nursing\n- Health Aids & Applicances\n- Hearing Aids\n- Blood Glucose Monitors\n- As well as all other lower tier inclusions\n\nSuper Extras Active from $16.51 per week\n- Ante Natal - Midwife\n- As well as all other lower tier inclusions\n\nTop Extras from $15.12 per week\n- Health Management\n- Online Doctor Appointments`;

    if (chatHistory.length === 0) {
        chatHistory.push({
            role: "user",
            parts: [{ text: systemInstructions }],
        });
    }

    if (userData.message) {
        chatHistory.push({
            role: "user",
            parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: userData.file }] : [])],
        });
        userData.message = null;
    }

    const geminiRequest = {
        contents: chatHistory,
    };

    const requestOptions = { // Request options are specific to each request.
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiRequest),
    };

    requestQueue.push({ incomingMessageDiv, geminiRequest: requestOptions }); // Queue the request
    processQueue(); // Process the queue
};



const handleOutgoingMessage = (e) => {
    e.preventDefault();
    userData.message = messageInput.value.trim();
    messageInput.value = "";
    messageInput.dispatchEvent(new Event("input"));
    fileUploadWrapper.classList.remove("file-uploaded");

    const messageContent = `<div class="message-text"></div>${userData.file.data ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="attachment" />` : ""}`;

    const outgoingMessageDiv = createMessageElement(messageContent, "user-message");
    outgoingMessageDiv.querySelector(".message-text").innerText = userData.message;
    chatBody.appendChild(outgoingMessageDiv);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

    setTimeout(() => {
        const botMessageContent = `<img class="bot-avatar" src="https://prod11-sprcdn-assets.sprinklr.com/11000004/40cb3338-1d3b-45d0-9594-56aed148e1b9-493754308/Brand_logo_3x_p.png" alt="Chatbot Logo" width="50" height="50"><div class="message-text"><div class="thinking-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;

        const incomingMessageDiv = createMessageElement(botMessageContent, "bot-message", "thinking");
        chatBody.appendChild(incomingMessageDiv);
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
        generateBotResponse(incomingMessageDiv);
    }, 600);
};

// Adjust input field height dynamically
messageInput.addEventListener("input", () => {
  messageInput.style.height = `${initialInputHeight}px`;
  messageInput.style.height = `${messageInput.scrollHeight}px`;
  document.querySelector(".chat-form").style.borderRadius = messageInput.scrollHeight > initialInputHeight ? "8px" : "8px";
});

// Handle Enter key press for sending messages
messageInput.addEventListener("keydown", (e) => {
  const userMessage = e.target.value.trim();
  if (e.key === "Enter" && !e.shiftKey && userMessage && window.innerWidth > 768) {
    handleOutgoingMessage(e);
  }
});

// Handle file input change and preview the selected file
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    fileInput.value = "";
    fileUploadWrapper.querySelector("img").src = e.target.result;
    fileUploadWrapper.classList.add("file-uploaded");
    const base64String = e.target.result.split(",")[1];

    // Store file data in userData
    userData.file = {
      data: base64String,
      mime_type: file.type,
    };
  };

  reader.readAsDataURL(file);
});

// Cancel file upload
fileCancelButton.addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("file-uploaded");
});

// Initialize emoji picker and handle emoji selection
const picker = new EmojiMart.Picker({
  theme: "light",
  skinTonePosition: "none",
  previewPosition: "none",
  onEmojiSelect: (emoji) => {
    const { selectionStart: start, selectionEnd: end } = messageInput;
    messageInput.setRangeText(emoji.native, start, end, "end");
    messageInput.focus();
  },
  onClickOutside: (e) => {
    if (e.target.id === "emoji-picker") {
      document.body.classList.toggle("show-emoji-picker");
    } else {
      document.body.classList.remove("show-emoji-picker");
    }
  },
});

document.querySelector(".chat-form").appendChild(picker);

sendMessage.addEventListener("click", (e) => handleOutgoingMessage(e));
document.querySelector("#file-upload").addEventListener("click", () => fileInput.click());
closeChatbot.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
chatbotToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));