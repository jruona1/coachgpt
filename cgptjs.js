document.addEventListener("DOMContentLoaded", function () {
    const inputBox = document.getElementById("inputBox");
    const submitBtn = document.getElementById("submitBtn");
    const toneSelect = document.getElementById("toneSelect");
    //keys
    const API_KEY = "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";  // Replace with your OpenAI API key
    const ASSISTANT_ID = "asst_xkx7mmDZtEMyJ1dZqS8QZ93j";
    let threadId = null; 

    async function fetchResponse(url, options) {
        try {
            const response = await fetch(url, options);
            const data = await response.json();
            
            if (!response.ok) {
                console.error("API Error:", data);
                throw new Error(`API request failed: ${data.error?.message || response.statusText}`);
            }
            return data;
        } catch (error) {
            console.error("Network/Fetch Error:", error);
            throw error;
        }
    }

    submitBtn.addEventListener("click", async function () {
        const userMessage = inputBox.value.trim();
        const selectedTone = toneSelect.value;

        if (!userMessage) {
            alert("Please enter a message before submitting.");
            return;
        }

    
        submitBtn.disabled = true;
        submitBtn.textContent = "Loading...";
        document.getElementById("loadingAnimation").style.display = "block";


        try {
        
            if (!threadId) {
                const threadResponse = await fetchResponse("https://api.openai.com/v1/threads", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${API_KEY}`,
                        "OpenAI-Beta": "assistants=v2", 
                        "Content-Type": "application/json"
                    }
                });

                console.log("Thread Created:", threadResponse);
                threadId = threadResponse.id;
            }

           
            await fetchResponse(`https://api.openai.com/v1/threads/${threadId}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "OpenAI-Beta": "assistants=v2", 
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    role: "user",
                    content: `The user wants you to respond in a(n) ${selectedTone} tone. Here is the message you are supposed to respond to: ${userMessage}. “If a user asks for a training plan, always return a full 4-week plan with clearly separated weeks. Use Markdown tables and include headers like Week 1, Week 2, etc.”`
                })
            });

            console.log("Message Sent!");

            
            const runResponse = await fetchResponse(`https://api.openai.com/v1/threads/${threadId}/runs`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "OpenAI-Beta": "assistants=v2", 
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ assistant_id: ASSISTANT_ID })
            });

            console.log("Run Started:", runResponse);
            const runId = runResponse.id;

            
            let runCompleted = false;
            let timeoutCounter = 0;

            while (!runCompleted && timeoutCounter < 60) { 
                await new Promise(r => setTimeout(r, 2000)); 

                const checkData = await fetchResponse(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
                    headers: {
                        "Authorization": `Bearer ${API_KEY}`,
                        "OpenAI-Beta": "assistants=v2", 
                        "Content-Type": "application/json"
                    }
                });

                console.log("Run Status:", checkData.status);

                if (checkData.status === "completed") {
                    runCompleted = true;
                } else if (checkData.status === "failed") {
                    throw new Error("Assistant run failed.");
                }
                timeoutCounter += 2;
            }

            if (!runCompleted) {
                throw new Error("Timeout: Assistant took too long to respond.");
            }

            
            const messagesData = await fetchResponse(`https://api.openai.com/v1/threads/${threadId}/messages`, {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "OpenAI-Beta": "assistants=v2", 
                    "Content-Type": "application/json"
                }
            });

            console.log("Messages Received:", messagesData);

            
            const lastMessage = messagesData.data.find(msg => msg.role === "assistant");

            let responseText = lastMessage ? lastMessage.content[0].text.value : "Error: No response received.";
            displayResponse(responseText);
        } catch (error) {
            displayResponse("Error: Unable to fetch response. Check console for details.");
            console.error("Error fetching response:", error);
        }
        document.getElementById("loadingAnimation").style.display = "none";
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    

    });

    function displayResponse(responseText) {
        const responseArea = document.getElementById("responseArea");
    
        
        const existingResponses = responseArea.querySelectorAll(".response-box");
        existingResponses.forEach(box => {
            const content = box.querySelector(".response-content");
            if (content) {
                content.style.display = "none";
            }
        });
    
        
        const responseBox = document.createElement("div");
        responseBox.classList.add("response-box");
    
        
        const header = document.createElement("div");
        header.classList.add("response-header");
        header.textContent = "Coach's Response (click to expand/collapse)";
        header.style.cursor = "pointer";
    
        const content = document.createElement("div");
        content.classList.add("response-content");
        content.innerHTML = marked.parse(responseText);
    
        header.addEventListener("click", () => {
            content.style.display = (content.style.display === "none") ? "block" : "none";
        });
    
        responseBox.appendChild(header);
        responseBox.appendChild(content);
        responseArea.prepend(responseBox);
    }
    
    
    
    function isTableFormat(text) {
        return text.includes("|") || text.includes("\t") || text.includes("\n-");
    }
    
    function formatAsTable(text) {
        let rows = text.split("\n").filter(row => row.trim() !== ""); 
    
        
        if (rows.length > 1 && rows[1].includes("-")) {
            rows.splice(1, 1);
        }
    
        let tableHTML = "<table border='1' style='border-collapse: collapse; width: 100%;'>";
        
        rows.forEach((row, index) => {
            let cols = row.split("|").map(col => col.trim()).filter(col => col !== "");
            if (cols.length === 0) return; 
    
            tableHTML += `<tr ${index === 0 ? "style='font-weight: bold; background: #ddd;'" : ""}>`;
            cols.forEach(col => {
                tableHTML += `<td style='padding: 8px; border: 1px solid #ccc;'>${col}</td>`;
            });
            tableHTML += "</tr>";
        });
    
        tableHTML += "</table>";
        return tableHTML;
    }
    
});



