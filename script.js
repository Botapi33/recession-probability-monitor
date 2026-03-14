let chartInstance = null;

function formatSpread(value) {
  return `${value.toFixed(2)} pp`;
}

function calculateScore(spread3m, spread2y) {
  const score3m = Math.max(0, -spread3m);
  const score2y = Math.max(0, -spread2y);
  return (score3m * 0.7) + (score2y * 0.3);
}

function calculateProbability(score) {
  const raw = 100 / (1 + Math.exp(-3 * (score - 0.7)));
  return Math.max(5, Math.min(95, Math.round(raw)));
}

function getRiskLevel(probability) {
  if (probability < 20) return "Low";
  if (probability < 40) return "Moderate";
  if (probability < 60) return "Elevated";
  return "High";
}

async function loadData() {
  const response = await fetch("./data/recession-probability-data.json");
  const data = await response.json();

  const series = data.series.map(item => {
    const score = calculateScore(item.spread_10y_3m, item.spread_10y_2y);
    const probability = calculateProbability(score);

    return {
      ...item,
      score,
      probability,
      riskLevel: getRiskLevel(probability)
    };
  });

  renderDashboard(series);
}

function renderDashboard(series) {
  const latest = series[series.length - 1];

  document.getElementById("probabilityValue").textContent = `${latest.probability}%`;
  document.getElementById("riskLevel").textContent = latest.riskLevel;
  document.getElementById("spread3m").textContent = formatSpread(latest.spread_10y_3m);
  document.getElementById("spread2y").textContent = formatSpread(latest.spread_10y_2y);

  const ctx = document.getElementById("probabilityChart").getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: series.map(item => item.date),
      datasets: [
        {
          label: "Estimated Probability",
          data: series.map(item => item.probability),
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
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
          }
        }
      }
    }
  });
}

loadData().catch(error => {
  console.error(error);
  document.body.innerHTML = `
    <div style="max-width:900px;margin:40px auto;padding:24px;background:#fff;border:1px solid #dbe3ee;border-radius:16px;font-family:Arial,sans-serif;">
      <h2>Unable to load data</h2>
      <p>Please check the JSON file for the Recession Probability Monitor.</p>
    </div>
  `;
});
