let probabilityChart = null;

function formatSpread(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(2)} pp`;
}

function formatProbability(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--%";
  }
  return `${Math.round(value)}%`;
}

function formatDate(dateString) {
  if (!dateString) return "--";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function calculateScore(spread3m, spread2y) {
  const score3m = Math.max(0, -spread3m);
  const score2y = Math.max(0, -spread2y);

  return (score3m * 0.7) + (score2y * 0.3);
}

function calculateProbability(score) {
  const rawProbability = 100 / (1 + Math.exp(-3 * (score - 0.7)));
  return Math.max(5, Math.min(95, Math.round(rawProbability)));
}

function getRiskLevel(probability) {
  if (probability < 20) return "Low";
  if (probability < 40) return "Moderate";
  if (probability < 60) return "Elevated";
  return "High";
}

function getRiskClass(riskLevel) {
  switch (riskLevel) {
    case "Low":
      return "risk-low";
    case "Moderate":
      return "risk-moderate";
    case "Elevated":
      return "risk-elevated";
    case "High":
      return "risk-high";
    default:
      return "";
  }
}

function enrichSeries(series) {
  return series.map((item) => {
    const spread3m = Number(item.spread_10y_3m);
    const spread2y = Number(item.spread_10y_2y);

    const score = calculateScore(spread3m, spread2y);
    const probability = calculateProbability(score);
    const riskLevel = getRiskLevel(probability);

    return {
      date: item.date,
      spread_10y_3m: spread3m,
      spread_10y_2y: spread2y,
      score,
      probability,
      riskLevel
    };
  });
}

function updateSummary(latestPoint, meta) {
  const probabilityEl = document.getElementById("probabilityValue");
  const riskLevelEl = document.getElementById("riskLevel");
  const spread3mEl = document.getElementById("spread3m");
  const spread2yEl = document.getElementById("spread2y");
  const latestDateEl = document.getElementById("latestDate");
  const modelVersionEl = document.getElementById("modelVersion");
  const interpretationEl = document.getElementById("currentInterpretation");

  if (probabilityEl) {
    probabilityEl.textContent = formatProbability(latestPoint.probability);
  }

  if (riskLevelEl) {
    riskLevelEl.textContent = latestPoint.riskLevel;
    riskLevelEl.className = `stat-value ${getRiskClass(latestPoint.riskLevel)}`;
  }

  if (spread3mEl) {
    spread3mEl.textContent = formatSpread(latestPoint.spread_10y_3m);
  }

  if (spread2yEl) {
    spread2yEl.textContent = formatSpread(latestPoint.spread_10y_2y);
  }

  if (latestDateEl) {
    latestDateEl.textContent = formatDate(latestPoint.date);
  }

  if (modelVersionEl) {
    modelVersionEl.textContent = meta && meta.model_version ? meta.model_version : "--";
  }

  if (interpretationEl) {
    if (latestPoint.riskLevel === "High") {
      interpretationEl.textContent =
        "The model currently signals a high estimated recession probability based on deeply restrictive or inverted yield curve conditions.";
    } else if (latestPoint.riskLevel === "Elevated") {
      interpretationEl.textContent =
        "The model currently signals elevated recession risk. Yield curve conditions remain consistent with cautious macro monitoring.";
    } else if (latestPoint.riskLevel === "Moderate") {
      interpretationEl.textContent =
        "The model currently signals moderate recession risk. Yield curve conditions are mixed and should be monitored closely.";
    } else {
      interpretationEl.textContent =
        "The model currently signals a relatively low estimated recession probability based on the latest Treasury curve readings.";
    }
  }
}

function buildChart(series) {
  const canvas = document.getElementById("probabilityChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (probabilityChart) {
    probabilityChart.destroy();
  }

  probabilityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: series.map((item) => item.date),
      datasets: [
        {
          label: "Estimated Recession Probability (12M)",
          data: series.map((item) => item.probability),
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: function(context) {
              return formatDate(context[0].label);
            },
            label: function(context) {
              return `Probability: ${context.parsed.y}%`;
            }
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: function(value) {
              return `${value}%`;
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxTicksLimit: 8,
            callback: function(value) {
              const label = this.getLabelForValue(value);
              const date = new Date(label);

              if (Number.isNaN(date.getTime())) {
                return label;
              }

              return date.toLocaleDateString("en-US", {
                year: "2-digit",
                month: "short"
              });
            }
          }
        }
      }
    }
  });
}

function showError(message) {
  document.body.innerHTML = `
    <div style="max-width:900px;margin:40px auto;padding:24px;background:#fff;border:1px solid #dbe3ee;border-radius:16px;font-family:Arial,Helvetica,sans-serif;">
      <h2 style="margin-top:0;">Unable to load Recession Probability Monitor</h2>
      <p style="margin-bottom:0;color:#5f6f85;">${message}</p>
    </div>
  `;
}

async function loadProbabilityData() {
  try {
    const response = await fetch("./data/recession-probability-data.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("The JSON data file could not be loaded.");
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.series) || data.series.length === 0) {
      throw new Error("The JSON file does not contain a valid series array.");
    }

    const enrichedSeries = enrichSeries(data.series);
    const latestPoint = enrichedSeries[enrichedSeries.length - 1];

    updateSummary(latestPoint, data.meta || {});
    buildChart(enrichedSeries);
  } catch (error) {
    console.error("Recession Probability Monitor error:", error);
    showError(error.message || "Unknown error while loading data.");
  }
}

document.addEventListener("DOMContentLoaded", loadProbabilityData);
