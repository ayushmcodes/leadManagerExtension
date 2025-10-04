# server.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types
import uvicorn
import re
import json
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI app
app = FastAPI(title="Email Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["chrome-extension://<extension-id>"]
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=[
        "Origin", "Content-Length", "Content-Type", "Authorization",
        "X-Requested-With", "Accept", "Accept-Language", "Accept-Encoding",
    ],
)

# Initialize GenAI client
client = genai.Client(api_key="AIzaSyCk1GkoVTYn3l3NcG9ePJQmJOt1Amyib6I")

# Request model
class MailRequest(BaseModel):
    company_name: str
    person_name: str

def markdown_to_html_bold(text: str) -> str:
    # Replace **bold** with <b>bold</b>
    text = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", text)
    # Replace *italic* or lone *bold* with <b>text</b>
    text = re.sub(r"\*(.*?)\*", r"<b>\1</b>", text)
    return text

def parse_model_response(response_text: str) -> dict:
    """
    Extracts JSON from the model's string response and returns a dict
    with 'subject' and 'body'.
    """
    # Remove backticks and optional "json"
    cleaned = re.sub(r"^```json", "", response_text, flags=re.IGNORECASE)
    cleaned = cleaned.replace("```", "").strip()

    # Parse JSON
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback if parsing fails
        return {"subject": "", "body": cleaned}

    # Some prompts might use 'bodyon' as key
    body_key = "bodyon" if "bodyon" in data else "body"
    return {
        "success": True,
        "subject": markdown_to_html_bold(data.get("subject", "")),
        "body": markdown_to_html_bold(data.get(body_key, ""))
    }


@app.post("/generate-mail")
async def generate_mail(request: MailRequest):
    try:
        # Create grounding tool
        grounding_tool = types.Tool(
            google_search=types.GoogleSearch()
        )

        # Config (optional if needed)
        config = types.GenerateContentConfig(
            tools=[grounding_tool],
            temperature=0
        )

        # Prepare prompt
        prompt = (
            f"for {request.company_name} write a mail and follow these rules "
            "1.Mention something specific about the company and start with Hi personname "
            "2. tell a tech problem the is very company specific and not a general problem "
            "3. Briefly explain how DevXworks can help them solve a problem and how their business might improve(quantify the benifits). "
            "when mentioning about devXworks start with At DevXworks "
            "4.ensure mail is well structed using bullet points and important keywords are in bold "
            "5.ensure word count is under 100."
            f"6.start with Hi {request.person_name} "
            "7.end with a low fricting CTA and add a clickable Calendly link using "
            "<a href='https://calendly.com/ayush-devxworks/intro-call-with-ayush-devxworks'>schedule a call</a> "
            "8.create a eye catcing subject, 5-8 words is ideal, subject should state how devxworks can help the company.dont format subject"
            "9. ensure email is well structured using HTML tags like <b>, <br>, <ul>, <li>. "
            "Do NOT use markdown formatting (like **, ##, *, etc.) anywhere. "
            "Do NOT use any Markdown formatting (**bold**, *, #, etc.) anywhere in the response."
            "Ensure all numbers, percentages, company names, and DevXworks mentions that should be bold are wrapped with <b> tags."
            "10. Ensure company name is wrapped in <b> tags and DevXworks is wrapped in <b> tags. "
            "11. response should be in form of a map only 2 keys subject and body"
            "12. dont use markup language anywhere in the response"
        )

        # Generate content
        email = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
        )

        parsed_email = parse_model_response(email.text)


        # Return email as JSON
        return parsed_email

    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
