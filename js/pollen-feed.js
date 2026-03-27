/**
 * @file app.js
 * @description This JavaScript file is responsible for fetching and displaying mold and other category level data from the PollenSense API.
 * It uses a gauge to display the current level and provides a list of hourly levels with corresponding times.
 * The data is fetched dynamically based on either the current date or a date passed via the URL as a query parameter.
 * Category codes are also passed via the URL to determine which data to display.
 *
 * Author: Earl Vhin Gabuat
 *
 * @version 1.1.0
 * @since 2024-09-12
 */

/** Gauge Display Options */
const gaugeOptions = {
    angle: 0.15,
    lineWidth: 0.44,
    radiusScale: 1,
    pointer: {
        length: 0.8,
        strokeWidth: 0.035,
        color: '#000000',
    },
    limitMax: true,
    limitMin: true,
    highDpiSupport: true,
    staticZones: [
        { strokeStyle: '#30B32D', min: 0, max: 24 }, // Low (0-24%)
        { strokeStyle: '#FFDD00', min: 25, max: 49 }, // Moderate (25-49%)
        { strokeStyle: '#F39C12', min: 50, max: 74 }, // High (50-74%)
        { strokeStyle: '#E74C3C', min: 75, max: 100 }, // Very High (75-100%)
    ],
    staticLabels: {
        font: '12px sans-serif',
        labels: [0, 25, 50, 75, 100],
        color: '#000000',
        fractionDigits: 0,
    },
    renderTicks: {
        divisions: 4,
        divWidth: 1.1,
        divLength: 0.7,
        divColor: '#333333',
        subDivisions: 3,
        subLength: 0.5,
        subWidth: 0.6,
        subColor: '#666666',
    },
};

/** API Configuration */
const apiConfig = {
    apiUrl: 'https://sensors.pollensense.com/api/v2/sites/1F42FA64-F647-4B4D-A976-076FAE469339/metrics',
    apiKey: 'QEF8v5gAUW7jXkLep6dvnfJm2WzgmgxMDz2ZYdQeBSNanPzpiPp9UaldwhsCq1PpsPiF65ECHxU6FCosSB3xWe',
    defaultInterval: 'hour', // Can be changed to 'day' or 'hour'
};

/**
 * Retrieves a URL query parameter value by name.
 * @param {string} name - The name of the query parameter.
 * @returns {string | null} The value of the query parameter or null if not found.
 */
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * Converts a passed date string (YYYY-MM-DD) to a UTC format string (YYYY-MM-DDTHH:MM:SSZ),
 * keeping the date intact but adjusting the time part.
 * @param {string} dateString - The original date string (YYYY-MM-DD) to format.
 * @param {boolean} isEndOfDay - Whether to set the time to the end of the day (23:59:59).
 * @returns {string} The formatted date string in UTC (YYYY-MM-DDTHH:MM:SSZ).
 */
function getFormattedDateUTC(dateString, isEndOfDay = false) {
    const timePart = isEndOfDay ? '23:59:59' : '00:00:00'; // Set time to either start or end of the day
    const formattedDate = `${dateString}T${timePart}Z`; // Combine date with the time and append 'Z' for UTC
    return formattedDate; // Return the formatted date
}

/**
 * Converts a date string (YYYY-MM-DD) into a human-readable format (e.g., September 12, 2024).
 * @param {string} dateString - The date string in YYYY-MM-DD format.
 * @returns {string} The formatted date in "Month Day, Year" format.
 */
function getHumanReadableDate(dateString) {
    const [year, month, day] = dateString.split('-'); // Split the string into year, month, and day parts
    const date = new Date(year, month - 1, day); // Create a new Date object (month is 0-indexed)

    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options); // Return formatted date
}

/**
 * Fetches data for the given category codes from the API and caches it in localStorage.
 * If cached data exists and is less than an hour old, the cached data is returned unless the `noCache` parameter is provided.
 * The `noCache` parameter in the URL allows bypassing the cache and fetching fresh data from the API.
 *
 * @param {Array<string>} categoryCodes - Array of category codes to fetch data for.
 * @returns {Promise<Object>} A promise that resolves to an object containing `moments` and `categories`.
 */
async function getDataByCategory(categoryCodes) {
    let urlDate = getUrlParameter('date');
    const noCache = getUrlParameter('noCache') === 'true'; // Check if noCache is set in the URL
    const interval = getUrlParameter('interval');

    // If no date is provided in the URL, use the current date
    if (!urlDate) {
        const today = new Date();
        urlDate = today.toISOString().split('T')[0]; // Use current date in YYYY-MM-DD format
    }

    // Format the start and end of the selected or current day
    const startingDate = getFormattedDateUTC(urlDate, false); // Start at 00:00:00 UTC
    const endingDate = getFormattedDateUTC(urlDate, true); // End at 23:59:59 UTC

    // Update the date display to a human-readable format
    if (urlDate) {
        document.getElementById('dateDisplay').textContent = getHumanReadableDate(urlDate);
    }

    // Create date-specific cache keys
    const cacheKey = `pollenData_${urlDate}`;
    const timeKey = `lastRequestTime_${urlDate}`;
    
    // Retrieve the last request time and stored data from localStorage for this specific date
    const lastRequestTime = localStorage.getItem(timeKey);
    const storedPollenData = JSON.parse(localStorage.getItem(cacheKey));

    // Check if data exists and the request was made within the last hour, but skip if noCache is true
    const oneHourInMilliseconds = 60 * 60 * 1000;
    const currentTime = new Date().getTime();

    if (!noCache && lastRequestTime && storedPollenData && currentTime - lastRequestTime < oneHourInMilliseconds) {
        console.log(`Using cached data for ${urlDate}`);
        return storedPollenData; // Return cached data
    } else {
        console.log('Fetching new data from API');

        // Fetch new data from API
        const response = await fetch(
            `${apiConfig.apiUrl}?interval=${
                interval || apiConfig.defaultInterval
            }&starting=${startingDate}&ending=${endingDate}`,
            {
                headers: {
                    'X-Ps-Key': apiConfig.apiKey,
                },
            },
        );

        const data = await response.json();

        // Cache the fetched data and request time in localStorage
        const responseData = {
            moments: data.Moments,
            categories: categoryCodes.map((code) => {
                return data.Categories.find((category) => category.CategoryCode === code);
            }),
            allCategories: data.Categories // Store all categories for peak misery analysis
        };

        // Save to localStorage with date-specific keys
        localStorage.setItem(cacheKey, JSON.stringify(responseData));
        localStorage.setItem(timeKey, currentTime);

        return responseData; // Return the fetched data
    }
}

function displayGaugesForCategories(categoriesData, moments) {
    let urlDate = getUrlParameter('date');
    const gaugeContainer = document.getElementById('gaugeContainer');
    const interval = getUrlParameter('interval');
    const displayTime = getUrlParameter('time');

    // If no date is provided in the URL, use the current date
    if (!urlDate) {
        const today = new Date();
        urlDate = today.toISOString().split('T')[0]; // Use current date in YYYY-MM-DD format
    }

    gaugeContainer.innerHTML = ''; // Clear any existing gauges

    categoriesData.forEach((categoryData, index) => {
        if (!categoryData) return; // Skip if category data is not available

        // Find the last non-null PPM and Misery values along with their corresponding moment
        let latestValidIndex = categoryData.PPM3.length - 1;

        // Traverse backwards to find the last valid PPM and Misery values
        while (latestValidIndex >= 0 && categoryData.PPM3[latestValidIndex] === null) {
            latestValidIndex--;
        }

        // If no valid data found, skip this category
        if (latestValidIndex === -1) {
            return;
        }

        const latestPPM = categoryData.PPM3[latestValidIndex];
        const latestMisery = categoryData.Misery ? (categoryData.Misery[latestValidIndex] * 100).toFixed(2) : 'N/A';
        const latestTime = moments[latestValidIndex]; // Corresponding moment for PPM and Misery

        // Create a container div for each gauge (with time, category description, and PPM labels)
        const canvasContainer = document.createElement('div');
        canvasContainer.classList.add('canvas-container');

        // Create the category description label
        const categoryLabel = document.createElement('div');
        categoryLabel.classList.add('gauge-category-label');
        categoryLabel.textContent = categoryData.CategoryDescription || 'Unknown Category';

        // Create the time label above the gauge, formatted as "As of [time]"
        const timeLabel = document.createElement('div');
        timeLabel.classList.add('gauge-time-label');

        // Display time in 12-hour format with AM/PM
        const time = latestTime.split('T')[1].split(':').slice(0, 2).join(':'); // Extract HH:MM from UTC string
        let [hour, minute] = time.split(':'); // Split hours and minutes
        hour = parseInt(hour, 10); // Convert hour to integer

        // Convert from 24-hour format to 12-hour format
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12; // Convert 0 to 12 for midnight and adjust hours greater than 12

        // Display the time in 12-hour format with AM/PM
        timeLabel.textContent = interval == 'day' ? `` : `As of ${hour}:${minute} ${ampm}`;

        // Create the canvas element for the gauge
        const canvas = document.createElement('canvas');
        canvas.id = `gaugeCanvas${index + 1}`;
        canvas.width = 300;
        canvas.height = 180;

        // Create the PPM label below the gauge
        const ppmLabel = document.createElement('div');
        ppmLabel.classList.add('gauge-ppm-label');

        // Check if latestMisery is not available
        const miseryText = latestMisery === 'N/A' ? 'Not Available' : `${latestMisery}%`;
        ppmLabel.textContent = `PPM: ${latestPPM.toFixed(2)} | Misery: ${miseryText}`;

        // Append the category, time, canvas, and PPM label to the container div
        canvasContainer.appendChild(categoryLabel);
        canvasContainer.appendChild(canvas);
        console.log({ displayTime });
        if (displayTime !== '0') canvasContainer.appendChild(timeLabel);
        canvasContainer.appendChild(ppmLabel);

        // Append the container div to the gaugeContainer
        gaugeContainer.appendChild(canvasContainer);

        // Create the gauge for each value
        const opts = gaugeOptions;
        const gauge = new Gauge(canvas).setOptions(opts);

        gauge.maxValue = 100; // 100% is the max value for the gauge
        gauge.setMinValue(0); // Start at 0
        gauge.animationSpeed = 32;
        gauge.set(latestMisery); // Set the Misery value as the gauge input
    });
}

/**
 * Analyzes all categories to find the top N peak misery times across the entire day.
 * @param {Array} allCategories - Complete array of all categories from API response
 * @param {Array} moments - Array of timestamps corresponding to data points
 * @param {number} topCount - Number of top results to return (default: 3)
 * @returns {Array} Top N peak misery entries sorted by misery level (highest first)
 */
function getTopPeakMiseryTimes(allCategories, moments, topCount = 3) {
    const peakMiseryEntries = [];
    
    // Process each category to find its peak misery value and time
    allCategories.forEach(categoryData => {
        if (!categoryData || !categoryData.Misery) return;
        
        let peakMisery = -1;
        let peakMiseryIndex = -1;
        
        // Find the highest misery value for this category
        categoryData.Misery.forEach((miseryValue, index) => {
            if (miseryValue !== null && miseryValue > peakMisery) {
                peakMisery = miseryValue;
                peakMiseryIndex = index;
            }
        });
        
        // If we found a valid peak misery value, record it
        if (peakMiseryIndex !== -1 && peakMisery > 0) {
            peakMiseryEntries.push({
                categoryCode: categoryData.CategoryCode,
                categoryDescription: categoryData.CategoryDescription,
                categoryCommonName: categoryData.CategoryCommonName || '',
                peakMisery: peakMisery,
                peakMiseryPercent: (peakMisery * 100).toFixed(2),
                peakTime: moments[peakMiseryIndex],
                ppmAtPeak: categoryData.PPM3[peakMiseryIndex]
            });
        }
    });
    
    // Sort by peak misery level (highest first) and return top N
    return peakMiseryEntries
        .sort((a, b) => b.peakMisery - a.peakMisery)
        .slice(0, topCount);
}

/**
 * Formats a UTC timestamp to human-readable 12-hour format
 * @param {string} utcTimestamp - UTC timestamp (e.g., "2025-10-08T15:00:00Z")
 * @returns {string} Formatted time (e.g., "3:00 PM")
 */
function formatTimeDisplay(utcTimestamp) {
    const time = utcTimestamp.split('T')[1].split(':').slice(0, 2).join(':'); // Extract HH:MM
    let [hour, minute] = time.split(':');
    hour = parseInt(hour, 10);
    
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    
    return `${hour}:${minute} ${ampm}`;
}

/**
 * Displays gauges for top peak misery categories showing their peak values and times
 * @param {Array} topPeakTimes - Array of top N peak misery entries
 * @param {Array} moments - Array of timestamps
 */
function displayPeakMiseryGauges(topPeakTimes, moments) {
    const gaugeContainer = document.getElementById('gaugeContainer');
    const interval = getUrlParameter('interval');
    const displayTime = getUrlParameter('time');
    
    if (!gaugeContainer) return;
    
    gaugeContainer.innerHTML = ''; // Clear any existing gauges
    
    topPeakTimes.forEach((peakData, index) => {
        const displayName = peakData.categoryCommonName || peakData.categoryDescription;
        
        // Create a container div for each gauge
        const canvasContainer = document.createElement('div');
        canvasContainer.classList.add('canvas-container');
        
        // Create the category description label
        const categoryLabel = document.createElement('div');
        categoryLabel.classList.add('gauge-category-label');
        categoryLabel.textContent = displayName || 'Unknown Category';
        
        // Create the time label showing when peak occurred
        const timeLabel = document.createElement('div');
        timeLabel.classList.add('gauge-time-label');
        
        // Display peak time in 12-hour format with AM/PM
        const time = peakData.peakTime.split('T')[1].split(':').slice(0, 2).join(':');
        let [hour, minute] = time.split(':');
        hour = parseInt(hour, 10);
        
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        
        timeLabel.textContent = interval == 'day' ? `` : `Peak at ${hour}:${minute} ${ampm}`;
        
        // Create the canvas element for the gauge
        const canvas = document.createElement('canvas');
        canvas.id = `gaugeCanvas${index + 1}`;
        canvas.width = 300;
        canvas.height = 180;
        
        // Create the PPM label showing peak values
        const ppmLabel = document.createElement('div');
        ppmLabel.classList.add('gauge-ppm-label');
        ppmLabel.textContent = `PPM: ${peakData.ppmAtPeak?.toFixed(2) || 'N/A'} | Peak Misery: ${peakData.peakMiseryPercent}%`;
        
        // Append elements to container
        canvasContainer.appendChild(categoryLabel);
        canvasContainer.appendChild(canvas);
        if (displayTime !== '0') canvasContainer.appendChild(timeLabel);
        canvasContainer.appendChild(ppmLabel);
        
        // Append container to gauge container
        gaugeContainer.appendChild(canvasContainer);
        
        // Create the gauge showing peak misery value
        const opts = gaugeOptions;
        const gauge = new Gauge(canvas).setOptions(opts);
        
        gauge.maxValue = 100;
        gauge.setMinValue(0);
        gauge.animationSpeed = 32;
        gauge.set(parseFloat(peakData.peakMiseryPercent)); // Set peak misery as gauge value
    });
}

/**
 * Displays the top N peak misery times in place of the gauge container
 * @param {Array} topPeakTimes - Array of top N peak misery entries
 */
function displayTopPeakMiseryTimes(topPeakTimes) {
    // Replace the gauge container content with peak misery data
    const gaugeContainer = document.getElementById('gaugeContainer');
    if (!gaugeContainer) return;
    
    // Build HTML content using existing gauge container styling
    let htmlContent = '';
    
    if (topPeakTimes.length === 0) {
        htmlContent = `
            <div class="canvas-container">
                <div class="gauge-category-label">No Peak Misery Data</div>
                <p>No significant misery data available for today.</p>
            </div>
        `;
    } else {
        // Create a "gauge" for each of the top N peak misery times
        topPeakTimes.forEach((entry, index) => {
            const displayName = entry.categoryCommonName || entry.categoryDescription;
            const timeFormatted = formatTimeDisplay(entry.peakTime);
            
            htmlContent += `
                <div class="canvas-container">
                    <div class="gauge-category-label">#${index + 1} Peak Misery</div>
                    <div class="category-label">${displayName}</div>
                    <div class="gauge-time-label">${timeFormatted}</div>
                    <div class="gauge-ppm-label">Misery: ${entry.peakMiseryPercent}% | PPM: ${entry.ppmAtPeak?.toFixed(2) || 'N/A'}</div>
                </div>
            `;
        });
    }
    
    gaugeContainer.innerHTML = htmlContent;
}

/**
 * Initializes the page by fetching data based on CategoryCode and displaying the gauges.
 */
async function init() {
    // Show loading state
    const gaugeContainer = document.getElementById('gaugeContainer');
    if (gaugeContainer) {
        gaugeContainer.innerHTML = '<div class="canvas-container"><div class="gauge-category-label">Loading...</div></div>';
    }
    
    try {
        // Get the category codes from the URL (for backward compatibility, but not used)
        const categoryCodesParam = getUrlParameter('categoryCodes');
        const categoryCodes = categoryCodesParam ? categoryCodesParam.split(',') : ['POL'];
        
        // Get the count from URL parameter (default: 3)
        const countParam = getUrlParameter('count');
        const topCount = countParam ? parseInt(countParam, 10) : 3;

        // Fetch data for all categories
        const { moments, categories, allCategories } = await getDataByCategory(categoryCodes);

        if (allCategories && allCategories.length > 0) {
            // Get top peak misery categories with their peak data
            const topPeakTimes = getTopPeakMiseryTimes(allCategories, moments, topCount);
            
            // Display gauges showing peak misery data instead of latest data
            displayPeakMiseryGauges(topPeakTimes, moments);
        } else {
            // Show no data message
            if (gaugeContainer) {
                gaugeContainer.innerHTML = '<div class="canvas-container"><div class="gauge-category-label">No Data Available</div></div>';
            }
        }
    } catch (error) {
        console.error('Error loading pollen data:', error);
        // Show error message
        if (gaugeContainer) {
            gaugeContainer.innerHTML = '<div class="canvas-container"><div class="gauge-category-label">Error Loading Data</div></div>';
        }
    }
}

// Initialize the page when loaded
window.onload = init;
