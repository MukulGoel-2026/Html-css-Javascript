// Array to store saved calculation results
let savedCalculations = [];
// Tracks the currently active calculator container ID
let activeCalculator = 'sipCalculatorContainer';
// Object to hold Chart.js instances for each calculator, allowing for destruction and recreation
let charts = {};

// API Configuration 
const apiKey = "AIzaSyAW5_GNVWuhM9bBsQbBQ6cmRmCAUWcclHw"; // Leave as-is for environment handling
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

/**
 * Utility to set the loading state on a button and display a message.
 */
function setLoadingState(buttonId, resultId, isLoading) {
    const button = document.getElementById(buttonId);
    const resultDiv = document.getElementById(resultId);

    if (isLoading) {
        button.disabled = true;
        button.innerHTML = 'Calculating...';
        resultDiv.innerHTML = 'Parsing text input and calculating...';
    } else {
        button.disabled = false;
        button.innerHTML = 'Calculate';
        if (resultDiv.innerHTML.includes('Parsing text input')) {
            resultDiv.innerHTML = ''; 
        }
    }
}

/**
 * Uses the Gemini API to convert natural language text (like "one lakh" or "15 percent") into a numerical value.
 */
async function parseTextToNumber(text) {
    if (text.trim() === '') {
        return null;
    }

    const systemPrompt = "You are a specialized text parser for financial calculations. Your task is to convert the user-provided text into a single numerical value. You must handle currency denominations common in India (like 'lakh', 'crore'). Ignore surrounding text. If the input is a percentage, return the raw number (e.g., '12 percent' should be 12, not 0.12). If the input is a currency amount (like 'one lakh' or '1,50,000'), return the total numerical value. The response MUST be a JSON object conforming to the provided schema.";

    const payload = {
        contents: [{ parts: [{ text: text }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "value": { "type": "NUMBER", "description": "The converted numerical value." },
                },
                required: ["value"]
            }
        }
    };

    let jsonResponse;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 429 || response.status >= 500) {
                    throw new Error(`Transient API error: ${response.statusText}`);
                }
                throw new Error(`API error: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                
                const jsonString = result.candidates[0].content.parts[0].text;
                jsonResponse = JSON.parse(jsonString);
                
                if (typeof jsonResponse.value === 'number') {
                    return jsonResponse.value;
                }
                if (typeof jsonResponse.value === 'string') {
                    const parsedNum = parseFloat(jsonResponse.value);
                    if (!isNaN(parsedNum)) {
                        return parsedNum;
                    }
                }
            }
            console.error("Gemini failed to return a valid JSON number for input:", text, result);
            return null;

        } catch (error) {
            if (error.message.startsWith('Transient API error') && attempt < 4) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                continue; 
            }
            console.error("Error during text parsing with Gemini API for input:", text, error);
            return null;
        }
    }
    return null; // Return null after all retries fail
}

/**
 * Switches the active calculator display.
 */
function showCalculator(calculatorId) {
    document.querySelectorAll('.calculator-container').forEach(container => {
        container.classList.remove('active');
    });
    document.getElementById(calculatorId).classList.add('active');
    activeCalculator = calculatorId;

    if (charts[calculatorId]) {
        charts[calculatorId].destroy();
        charts[calculatorId] = null;
    }
}

/**
 * Formats a number into Indian currency format (e.g., ₹1,23,45,678.90).
 */
function formatIndianCurrency(number) {
    if (isNaN(number)) return '';
    const formattedNumber = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(number);
    return `₹${formattedNumber}`;
}

/**
 * Converts a number to its Indian number name representation.
 */
function numberToWords(n) {
    if (n === 0) return "Zero";

    n = Math.abs(Math.round(n));
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertLessThanOneThousand(num) {
        let result = '';
        if (num >= 100) {
            result += units[Math.floor(num / 100)] + ' Hundred ';
            num %= 100;
        }
        if (num >= 20) {
            result += tens[Math.floor(num / 10)] + ' ';
            num %= 10;
        }
        if (num >= 10) {
            result += teens[num - 10] + ' ';
            num = 0;
        }
        if (num > 0) {
            result += units[num] + ' ';
        }
        return result.trim();
    }

    let words = [];
    let crore = Math.floor(n / 10000000);
    if (crore > 0) {
        words.push(convertLessThanOneThousand(crore) + ' Crore');
        n %= 10000000;
    }
    let lakh = Math.floor(n / 100000);
    if (lakh > 0) {
        words.push(convertLessThanOneThousand(lakh) + ' Lakh');
        n %= 100000;
    }
    let thousand = Math.floor(n / 1000);
    if (thousand > 0) {
        words.push(convertLessThanOneThousand(thousand) + ' Thousand');
        n %= 1000;
    }
    let remaining = n;
    if (remaining > 0) {
        words.push(convertLessThanOneThousand(remaining));
    }
    return words.join(' ').trim() || "Zero";
}

/**
 * Calculates the Systematic Investment Plan (SIP) maturity value.
 */
async function calculateSIP() {
    setLoadingState('sipCalculateButton', 'sipResult', true);

    const amountText = document.getElementById('sipAmount').value;
    const rateText = document.getElementById('sipRate').value;
    const amount = await parseTextToNumber(amountText);
    const rateRaw = await parseTextToNumber(rateText);

    const tenureYears = parseInt(document.getElementById('sipTenure').value);
    const tenureMonths = tenureYears * 12;
    const inflationInput = document.getElementById('sipInflation').value;
    const inflationRate = parseFloat(inflationInput) / 100 / 12;
    const rate = (rateRaw / 100) / 12;

    if (amount === null || rateRaw === null || isNaN(inflationRate) || amount <= 0 || rateRaw < 0 || tenureYears <= 0) {
        document.getElementById('sipResult').innerText = "ERROR: Please ensure Monthly Investment and Interest Rate are valid numbers or text descriptions. All inputs must be posiitive";
        document.getElementById('sipNumberName').innerText = "";
        if (charts['sipCalculatorContainer']) { charts['sipCalculatorContainer'].destroy(); charts['sipCalculatorContainer'] = null; }
        setLoadingState('sipCalculateButton', 'sipResult', false);
        return;
    }

    let futureValue;
    if (rate === 0) {
            futureValue = amount * tenureMonths;
    } else {
            futureValue = amount * (((Math.pow(1 + rate, tenureMonths) - 1) / rate) * (1 + rate));
    }
    
    const presentValueAdjusted = futureValue / Math.pow(1 + inflationRate, tenureMonths);
    const totalInvestment = amount * tenureMonths;
    const interestEarned = futureValue - totalInvestment;

    const resultText = `
        Total Investment: ${formatIndianCurrency(totalInvestment)}<br>
        Estimated Maturity Value: ${formatIndianCurrency(futureValue)}<br>
        Interest Earned: ${formatIndianCurrency(interestEarned)}<br>
        Estimated Present Value (Inflation Adjusted): ${formatIndianCurrency(presentValueAdjusted)}
    `;
    document.getElementById('sipResult').innerHTML = resultText;
    document.getElementById('sipNumberName').innerText = `Estimated Maturity Value (in words): ${numberToWords(Math.round(futureValue))}`;

    displayChart('sipCalculatorContainer', 'SIP', totalInvestment, futureValue, interestEarned);
    setLoadingState('sipCalculateButton', 'sipResult', false);
}

/**
 * Calculates the Fixed Deposit (FD) maturity value.
 */
async function calculateFD() {
    setLoadingState('fdCalculateButton', 'fdResult', true);

    const principalText = document.getElementById('fdPrincipal').value;
    const rateText = document.getElementById('fdRate').value;
    const principal = await parseTextToNumber(principalText);
    const rateRaw = await parseTextToNumber(rateText);

    const rate = rateRaw / 100;
    const tenure = parseFloat(document.getElementById('fdTenure').value);
    const inflationInput = document.getElementById('fdInflation').value;
    const inflationRate = parseFloat(inflationInput) / 100;

    if (principal === null || rateRaw === null || isNaN(inflationRate) || principal <= 0 || rateRaw < 0 || tenure <= 0) {
        document.getElementById('fdResult').innerText = "ERROR: Please ensure Monthly Inveand stment and Interest Rate are valid numbers or text descriptions. All inputs must be positive.";
        document.getElementById('fdNumberName').innerText = "";
        if (charts['fdCalculatorContainer']) { charts['fdCalculatorContainer'].destroy(); charts['fdCalculatorContainer'] = null; }
        setLoadingState('fdCalculateButton', 'fdResult', false);
        return;
    }

    const maturityValue = principal * Math.pow(1 + rate, tenure);
    const presentValueAdjusted = maturityValue / Math.pow(1 + inflationRate, tenure);
    const interestEarned = maturityValue - principal;

    const resultText = `
        Principal Amount: ${formatIndianCurrency(principal)}<br>
        Estimated Maturity Value: ${formatIndianCurrency(maturityValue)}<br>
        Interest Earned: ${formatIndianCurrency(interestEarned)}<br>
        Estimated Present Value (Inflation Adjusted): ${formatIndianCurrency(presentValueAdjusted)}
    `;
    document.getElementById('fdResult').innerHTML = resultText;
    document.getElementById('fdNumberName').innerText = `Estimated Maturity Value (in words): ${numberToWords(Math.round(maturityValue))}`;

    displayChart('fdCalculatorContainer', 'FD', principal, maturityValue, interestEarned);
    setLoadingState('fdCalculateButton', 'fdResult', false);
}

/**
 * Calculates the Equated Monthly Installment (EMI) for a loan.
 */
async function calculateEMI() {
    setLoadingState('emiCalculateButton', 'emiResult', true);

    const principalText = document.getElementById('loanAmount').value;
    const rateText = document.getElementById('interestRate').value;
    const principal = await parseTextToNumber(principalText);
    const rateRaw = await parseTextToNumber(rateText);

    const rate = (rateRaw / 100) / 12;
    const tenureYears = parseInt(document.getElementById('loanTenure').value);
    const tenureMonths = tenureYears * 12;

    if (principal === null || rateRaw === null || principal <= 0 || rateRaw < 0 || tenureYears <= 0) {
        document.getElementById('emiResult').innerText = "ERROR: Please ensure Monthly Investment and Interest Rate are valid numbers or text descriptions. All inputs must be positive.";
        document.getElementById('emiNumberName').innerText = "";
        if (charts['emiCalculatorContainer']) { charts['emiCalculatorContainer'].destroy(); charts['emiCalculatorContainer'] = null; }
        setLoadingState('emiCalculateButton', 'emiResult', false);
        return;
    }

    let emi;
    if (rate === 0) {
        emi = principal / tenureMonths;
    } else {
        emi = (principal * rate * Math.pow(1 + rate, tenureMonths)) / (Math.pow(1 + rate, tenureMonths) - 1);
    }

    const emiFormatted = formatIndianCurrency(emi.toFixed(2));
    document.getElementById('emiResult').innerText = `Estimated Monthly EMI: ${emiFormatted}`;
    document.getElementById('emiNumberName').innerText = `Estimated Monthly EMI (in words): ${numberToWords(Math.round(emi))}`;

    const totalPayable = emi * tenureMonths;
    const totalInterest = totalPayable - principal;
    displayChart('emiCalculatorContainer', 'EMI', principal, totalPayable, totalInterest);
    setLoadingState('emiCalculateButton', 'emiResult', false);
}

/**
 * Displays a bar chart using Chart.js for the given financial data.
 */
function displayChart(containerId, type, principal, maturityValue, interest) {
    const chartContainer = document.getElementById(containerId).querySelector('.chart-container');
    if (!chartContainer) {
        return;
    }
    if (charts[containerId]) {
        charts[containerId].destroy();
        charts[containerId] = null;
    }
    chartContainer.innerHTML = '';
    const ctx = document.createElement('canvas');
    chartContainer.appendChild(ctx);

    let labels, data, backgroundColors, borderColors;
    let totalPayable = maturityValue;
    if (type === 'EMI') {
        labels = ['Loan Amount', 'Total Payable', 'Total Interest'];
        data = [principal, totalPayable, interest];
        backgroundColors = [
            'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)' 
        ];
        borderColors = [
            'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)'
        ];
    } else { // SIP or FD
        labels = ['Amount Invested', 'Maturity Value', 'Interest Earned'];
        data = [principal, maturityValue, interest];
        backgroundColors = [
            'rgba(75, 192, 192, 0.6)', 'rgba(101, 205, 158, 0.6)', 'rgba(255, 159, 64, 0.6)'
        ];
        borderColors = [
            'rgba(75, 192, 192, 1)', 'rgba(101, 205, 158, 1)', 'rgba(255, 159, 64, 1)'
        ];
    }

    charts[containerId] = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: labels,
            datasets: [{
                label: `${type} Analysis`,
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return formatIndianCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatIndianCurrency(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Saves the current calculation result to the savedCalculations array.
 */
function saveResult(calculatorType, result) {
    if (!result || result.includes('ERROR')) return;
    savedCalculations.push({
        type: calculatorType,
        result: result,
        timestamp: new Date().toLocaleString()
    });
    displaySavedResults();
}

/**
 * Renders the saved calculations in the 'savedResults' div.
 */
function displaySavedResults() {
    const savedResultsDiv = document.getElementById('savedResults');
    savedResultsDiv.innerHTML = "";
    if (savedCalculations.length > 0) {
        const ul = document.createElement('ul');
        ul.classList.add('list-disc', 'list-inside', 'space-y-2');
        savedCalculations.forEach((item) => {
            const li = document.createElement('li');
            li.classList.add('p-2', 'bg-white', 'rounded-md', 'shadow-sm');
            const cleanResult = item.result.replace(/<br>/g, ' '); 
            li.innerHTML = `<span class="font-semibold text-gray-700">${item.type.toUpperCase()} Calculation</span> <span class="text-sm text-gray-500">(${item.timestamp})</span>: <br><span class="text-green-700">${cleanResult}</span>`;
            ul.appendChild(li);
        });
        savedResultsDiv.appendChild(ul);
    } else {
        savedResultsDiv.innerText = "No results saved yet.";
    }
}

// Initial setup when the page loads
window.onload = function() {
    document.getElementById('sipTenureValue').textContent = document.getElementById('sipTenure').value;
    document.getElementById('fdTenureValue').textContent = document.getElementById('fdTenure').value;
    document.getElementById('loanTenureValue').textContent = document.getElementById('loanTenure').value;
    displaySavedResults();
    showCalculator('sipCalculatorContainer'); // Display SIP by default
};
