const startAnalysis = async () => {
  if (!file) {
    alert("Please upload a video first.");
    return;
  }

  setProcessing(true);

  try {
    // =====================================================
    // STEP 1: UPLOAD VIDEO
    // =====================================================

    console.log("Uploading video...");

    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await fetch(
      "/api/upload",
      {
        method: "POST",
        body: formData
      }
    );

    if (!uploadResponse.ok) {
      throw new Error(
        "Video upload failed. Status: " +
          uploadResponse.status
      );
    }

    const uploadResult =
      await uploadResponse.json();

    console.log(
      "Upload response:",
      uploadResult
    );

    const jobId =
      uploadResult.job_id ||
      uploadResult.id ||
      uploadResult;

    if (!jobId) {
      throw new Error(
        "Backend did not return a job ID."
      );
    }

    console.log(
      "Created Job ID:",
      jobId
    );

    // =====================================================
    // STEP 2: DETERMINE FREQUENCY RANGE
    // =====================================================

    let lowHz = 10;
    let highHz = 200;

    if (preset === "structural") {
      lowHz = 0.1;
      highHz = 50;
    }

    if (preset === "custom") {
      if (
        !minHz ||
        !maxHz ||
        Number(minHz) >= Number(maxHz)
      ) {
        setProcessing(false);

        alert(
          "Please enter valid minimum and maximum Hz values."
        );

        return;
      }

      lowHz = Number(minHz);
      highHz = Number(maxHz);
    }

    // =====================================================
    // STEP 3: SUBMIT ROI + FREQUENCY SETTINGS
    // =====================================================

    const roiData = {
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      preset: preset,
      low_hz: lowHz,
      high_hz: highHz,
      alpha: 8
    };

    console.log(
      "Sending ROI:",
      roiData
    );

    const roiResponse = await fetch(
      `/api/jobs/${jobId}/roi`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(roiData)
      }
    );

    if (!roiResponse.ok) {
      const errorText =
        await roiResponse.text();

      throw new Error(
        "ROI submission failed. Status: " +
          roiResponse.status +
          " - " +
          errorText
      );
    }

    const roiResult =
      await roiResponse.json();

    console.log(
      "ROI response:",
      roiResult
    );

    // =====================================================
    // STEP 4: START BACKEND PROCESSING
    // =====================================================

    console.log(
      "Starting backend processing..."
    );

    const processResponse = await fetch(
      `/api/jobs/${jobId}/process`,
      {
        method: "POST"
      }
    );

    if (!processResponse.ok) {
      const errorText =
        await processResponse.text();

      throw new Error(
        "Processing request failed. Status: " +
          processResponse.status +
          " - " +
          errorText
      );
    }

    const processResult =
      await processResponse.json();

    console.log(
      "Processing response:",
      processResult
    );

    // =====================================================
    // STEP 5: SAVE JOB INFORMATION
    // =====================================================

    const analysisData = {
      job_id: jobId,

      upload: uploadResult,

      roi: roiResult,

      process: processResult,

      file_name: file.name,

      preset: preset,

      low_hz: lowHz,

      high_hz: highHz,

      alpha: 8
    };

    sessionStorage.setItem(
      "motionAmpResult",
      JSON.stringify(analysisData)
    );

    console.log(
      "Analysis request submitted successfully."
    );

    // =====================================================
    // STEP 6: DO NOT IMMEDIATELY SHOW RESULTS
    // =====================================================
    // The backend uses BackgroundTasks.
    // Therefore /process returns "processing"
    // before the ML analysis is actually finished.
    //
    // For now, send the job information to the next page.
    // Later we can add status polling.

    setProcessing(false);

    if (props.onAnalysisComplete) {
      props.onAnalysisComplete(
        analysisData
      );
    }

  } catch (error) {
    console.error(
      "Motion AMP backend error:",
      error
    );

    setProcessing(false);

    alert(
      "Motion AMP processing failed.\n\n" +
        error.message
    );
  }
};