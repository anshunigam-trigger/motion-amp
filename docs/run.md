##### **Step 1 — Install the one new dependency**

pip install -r requirements.txt



##### **Step 2 — Start the server**

uvicorn app.main:app --reload



You should see output ending with something like Uvicorn running on http://127.0.0.1:8000. Leave this terminal window open and running — it's your live server now. --reload means it'll automatically restart if you edit the code, which is handy while developing.



Important practical note (this connects back to something we flagged in config.py earlier): wherever you run this command from is where uploads/, results/, and jobs.db will actually get created — so make sure you're running it from inside backend/, not some other folder, or you'll be hunting for files in the wrong place.





##### **Step 3 — Check it's alive**

Open a second terminal (keep the server running in the first one), and visit this URL in your browser:

http://127.0.0.1:8000/



You should see {"status": "backend is running"}.



Also worth seeing — FastAPI automatically builds an interactive testing page for you, no extra code needed:



http://127.0.0.1:8000/docs



This shows every endpoint we've built, and lets you actually try them from the browser instead of using terminal commands. Good to know about either way — I'll give you both options below.





##### **Step 4 — Upload a test clip**

Using curl (in your second terminal, from the backend folder):



curl -X POST "http://127.0.0.1:8000/api/upload" -F "file=@../test\_clips/vibrating\_panel.mp4"



This should return something like:



json

{"job\_id": "some-long-uuid-here", "filename": "vibrating\_panel.mp4"}



Copy that job\_id — you'll need it for every step after this.





##### **Step 5 — Submit the ROI and settings**

Using the tight edge box we validated earlier (x=135, y=40, w=10, h=160), and the 10–20Hz band that correctly found our known 15Hz signal:



bash

curl -X POST "http://127.0.0.1:8000/api/jobs/YOUR\_JOB\_ID/roi" ^

&#x20; -H "Content-Type: application/json" ^

&#x20; -d "{\\"x\\": 135, \\"y\\": 40, \\"w\\": 10, \\"h\\": 160, \\"preset\\": \\"custom\\", \\"low\_hz\\": 10, \\"high\_hz\\": 20, \\"alpha\\": 5}"



(That ^ line-continuation is Windows Command Prompt syntax — replace YOUR\_JOB\_ID with the real one from Step 4.)





##### **Step 6 — Start processing**

bash

curl -X POST "http://127.0.0.1:8000/api/jobs/YOUR\_JOB\_ID/process"



Should return {"status": "processing", "job\_id": "..."}. This kicks off run\_processing in the background — the terminal running the server will keep responding immediately; the actual work happens behind the scenes.





##### **Step 7 — Check status until it's done**

bash

curl "http://127.0.0.1:8000/api/jobs/YOUR\_JOB\_ID/status"



Run this every few seconds — it'll say "processing" at first, then "done" (or "failed" if something went wrong — check the server's terminal window for the printed error message if so).





##### **Step 8 — Get the real result**

bash

curl "http://127.0.0.1:8000/api/jobs/YOUR\_JOB\_ID/result"



What to actually look for: dominant\_freq\_hz should come out close to 15 (our known ground truth), and flag should say "periodic\_vibration\_detected". If you see that, it means the entire system — upload, database, our real pipeline, our real detection — just worked together for the first time, end to end.





