// SheetDB API configuration
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/p844ojwexubcm';
const USER_API_URL = 'https://sheetdb.io/api/v1/rdh2pafbx2uj9';
const PRODUCT_API_URL = 'https://sheetdb.io/api/v1/svtry1tyrxfjy';

let records = [];
let products = [];
let currentUser = null;

// Enhanced stage probabilities with monthly breakdown and colors
const stageProbabilities = {
    'prospecting': { winning: 10, buying: 5, color: '#ffeaa7' },
    'demo-request': { winning: 20, buying: 10, color: '#81ecec' },
    'demo-on': { winning: 30, buying: 15, color: '#74b9ff' },
    'demo-completed': { winning: 40, buying: 20, color: '#a29bfe' },
    'quoted': { winning: 50, buying: 10, color: '#fd79a8' },
    'quote': { winning: 60, buying: 10, color: '#fdcb6e' },
    'negotiation': { winning: 70, buying: 10, color: '#00cec9' },
    'ordered': { winning: 100, buying: 100, color: '#55efc4' },
    'delivered': { winning: 100, buying: 0, color: '#00b894' },
    'lost': { winning: 0, buying: 0, color: '#dfe6e9' }
};

// Chart instances
let pipelineStageChart, monthlyTrendChart, hospitalValueChart, doctorsChart;
let forecastTrendChart, productPerformanceChart;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApplication();
    setupEventListeners();
});

function initializeApplication() {
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(savedUser);
    
    initCharts();
    loadProducts();
    loadRecords();
    updateUserDisplay();
    setupStickyHeaders();
}

function setupEventListeners() {
    // Filter event listeners
    ['stageFilter', 'hospitalFilter', 'productFilter', 'distributorFilter', 'salesPersonFilter'].forEach(id => {
        document.getElementById(id).addEventListener('change', displayRecords);
    });
    
    // Search functionality
    document.getElementById('searchInput').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') searchRecords();
    });
    
    // Close user menu when clicking outside
    document.addEventListener('click', function(event) {
        const userMenu = document.getElementById('userMenu');
        const userInfo = document.querySelector('.user-info');
        
        if (!userInfo.contains(event.target) && !userMenu.contains(event.target)) {
            userMenu.classList.remove('active');
        }
    });

    // Tab switching functionality
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Show corresponding content
            const tabId = this.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Update charts when switching to dashboard tab
            if (tabId === 'dashboard') {
                updateCharts();
            }
            // Update product forecast when switching to product forecast tab
            if (tabId === 'product-forecast') {
                updateProductForecast();
            }
        });
    });
}

function setupStickyHeaders() {
    const recordsTab = document.getElementById('records-tab');
    const addButton = recordsTab.querySelector('.buy-box');
    const tableHeader = recordsTab.querySelector('thead');
    
    // Make add button sticky
    if (addButton) {
        addButton.style.position = 'sticky';
        addButton.style.top = '0';
        addButton.style.zIndex = '100';
        addButton.style.backgroundColor = '#fff';
    }
    
    // Make table header sticky
    if (tableHeader) {
        tableHeader.style.position = 'sticky';
        tableHeader.style.top = addButton ? '60px' : '0';
        tableHeader.style.zIndex = '90';
        tableHeader.style.backgroundColor = '#f8f9fa';
    }
}

// Toggle user menu
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    userMenu.classList.toggle('active');
}

// Enhanced Product Forecast Functions
function calculateProductForecast() {
    const productData = {};
    const monthlyProductData = {};
    
    // Get current date for monthly calculations
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    records.forEach(record => {
        if (record.pipelineStage !== 'lost') {
            const product = record.productName || 'Uncategorized';
            
            // Initialize product data
            if (!productData[product]) {
                productData[product] = {
                    opportunities: 0,
                    totalValue: 0,
                    weightedForecast: 0,
                    dealSizes: [],
                    monthlyData: {},
                    stages: {}
                };
            }
            
            // Basic product metrics
            productData[product].opportunities++;
            productData[product].totalValue += record.potentialValue;
            productData[product].weightedForecast += record.weightedForecast;
            productData[product].dealSizes.push(record.potentialValue);
            
            // Stage distribution
            if (!productData[product].stages[record.pipelineStage]) {
                productData[product].stages[record.pipelineStage] = 0;
            }
            productData[product].stages[record.pipelineStage]++;
            
            // Monthly analysis
            if (record.forecastMonth) {
                const [year, month] = record.forecastMonth.split('-');
                const monthKey = `${year}-${month.padStart(2, '0')}`;
                
                if (!productData[product].monthlyData[monthKey]) {
                    productData[product].monthlyData[monthKey] = {
                        value: 0,
                        forecast: 0,
                        count: 0
                    };
                }
                
                productData[product].monthlyData[monthKey].value += record.potentialValue;
                productData[product].monthlyData[monthKey].forecast += record.weightedForecast;
                productData[product].monthlyData[monthKey].count++;
            }
        }
    });
    
    // Calculate additional metrics
    Object.keys(productData).forEach(product => {
        const data = productData[product];
        data.averageDealSize = data.opportunities > 0 ? data.totalValue / data.opportunities : 0;
        data.winRate = data.totalValue > 0 ? (data.weightedForecast / data.totalValue * 100) : 0;
        data.monthlyTrend = calculateMonthlyTrend(data.monthlyData);
        data.forecastAccuracy = calculateForecastAccuracy(data);
    });
    
    return productData;
}

function calculateMonthlyTrend(monthlyData) {
    const months = Object.keys(monthlyData).sort();
    if (months.length < 2) return 'stable';
    
    const firstMonth = monthlyData[months[0]].forecast;
    const lastMonth = monthlyData[months[months.length - 1]].forecast;
    
    if (lastMonth > firstMonth * 1.1) return 'growing';
    if (lastMonth < firstMonth * 0.9) return 'declining';
    return 'stable';
}

function calculateForecastAccuracy(productData) {
    const closedDeals = Object.values(productData.stages).reduce((a, b) => a + b, 0);
    const wonDeals = (productData.stages['ordered'] || 0) + (productData.stages['delivered'] || 0);
    return closedDeals > 0 ? (wonDeals / closedDeals) * 100 : 0;
}

function updateProductForecast() {
    const productData = calculateProductForecast();
    const productForecastGrid = document.getElementById('productForecastGrid');
    const productForecastTable = document.getElementById('productForecastTable');
    
    // Clear existing content
    productForecastGrid.innerHTML = '';
    productForecastTable.innerHTML = '';
    
    // Create enhanced product forecast cards
    Object.keys(productData).forEach(product => {
        const data = productData[product];
        const progressPercentage = data.totalValue > 0 ? (data.weightedForecast / data.totalValue * 100) : 0;
        const trendIcon = getTrendIcon(data.monthlyTrend);
        
        const card = document.createElement('div');
        card.className = 'product-forecast-card';
        card.innerHTML = `
            <div class="product-forecast-header">
                <div class="product-name">${product}</div>
                <div class="product-metrics">
                    <span class="product-quantity">${data.opportunities} opps</span>
                    <span class="trend-indicator ${data.monthlyTrend}">${trendIcon}</span>
                </div>
            </div>
            <div class="product-forecast-value">${formatCurrency(data.weightedForecast)}</div>
            <div class="product-forecast-progress">
                <div class="product-progress-bar" style="width: ${progressPercentage}%"></div>
            </div>
            <div class="product-forecast-stats">
                <span>Potential: ${formatCurrency(data.totalValue)}</span>
                <span>${progressPercentage.toFixed(1)}%</span>
            </div>
            <div class="product-forecast-details">
                <div class="detail-item">
                    <span>Avg Deal:</span>
                    <span>${formatCurrency(data.averageDealSize)}</span>
                </div>
                <div class="detail-item">
                    <span>Win Rate:</span>
                    <span>${data.winRate.toFixed(1)}%</span>
                </div>
            </div>
            ${renderStageDistribution(data.stages)}
        `;
        productForecastGrid.appendChild(card);
        
        // Add to detailed table
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product}</td>
            <td>${data.opportunities}</td>
            <td>${formatCurrency(data.totalValue)}</td>
            <td>${formatCurrency(data.weightedForecast)}</td>
            <td>${formatCurrency(data.averageDealSize)}</td>
            <td>${data.winRate.toFixed(1)}%</td>
            <td><span class="trend-badge ${data.monthlyTrend}">${data.monthlyTrend}</span></td>
        `;
        productForecastTable.appendChild(row);
    });
    
    updateProductPerformanceChart(productData);
}

function getTrendIcon(trend) {
    const icons = {
        'growing': '📈',
        'declining': '📉',
        'stable': '➡️'
    };
    return icons[trend] || '➡️';
}

function renderStageDistribution(stages) {
    let html = '<div class="stage-distribution">';
    Object.keys(stages).forEach(stage => {
        if (stages[stage] > 0) {
            html += `<span class="stage-tag" style="background-color: ${stageProbabilities[stage]?.color || '#ccc'}">${stage}: ${stages[stage]}</span>`;
        }
    });
    html += '</div>';
    return html;
}

function updateProductPerformanceChart(productData) {
    const products = Object.keys(productData);
    const potentialValues = products.map(product => productData[product].totalValue);
    const weightedForecasts = products.map(product => productData[product].weightedForecast);
    
    if (window.productPerformanceChart) {
        productPerformanceChart.data.labels = products;
        productPerformanceChart.data.datasets[0].data = potentialValues;
        productPerformanceChart.data.datasets[1].data = weightedForecasts;
        productPerformanceChart.update();
    }
}

// Enhanced Chart Initialization
function initCharts() {
    // Pipeline by Stage Chart
    const pipelineStageCtx = document.getElementById('pipelineStageChart').getContext('2d');
    pipelineStageChart = new Chart(pipelineStageCtx, {
        type: 'doughnut',
        data: {
            labels: ['Prospecting', 'Demo Request', 'Demo On', 'Demo Completed', 'Quoted', 'Quote', 'Negotiation', 'Ordered', 'Delivered', 'Lost'],
            datasets: [{
                data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                backgroundColor: [
                    '#ffeaa7', '#81ecec', '#74b9ff', '#a29bfe', '#fd79a8', '#fdcb6e', '#00cec9', '#55efc4', '#00b894', '#dfe6e9'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: false
                }
            },
            onClick: function(evt, elements) {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const label = this.data.labels[index];
                    const stage = label.toLowerCase().replace(' ', '-');
                    
                    // Set the stage filter
                    document.getElementById('stageFilter').value = stage;
                    
                    // Switch to records tab
                    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                    document.querySelector('[data-tab="records"]').classList.add('active');
                    document.getElementById('records-tab').classList.add('active');
                    
                    // Display the filtered records
                    displayRecords();
                }
            }
        }
    });
    
    // Monthly Trend Chart
    const monthlyTrendCtx = document.getElementById('monthlyTrendChart').getContext('2d');
    monthlyTrendChart = new Chart(monthlyTrendCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Potential Value',
                data: [],
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                fill: true,
                tension: 0.3
            }, {
                label: 'Weighted Forecast',
                data: [],
                borderColor: '#4cc9f0',
                backgroundColor: 'rgba(76, 201, 240, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Hospital Value Chart
    const hospitalValueCtx = document.getElementById('hospitalValueChart').getContext('2d');
    hospitalValueChart = new Chart(hospitalValueCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Total Value',
                data: [],
                backgroundColor: '#4361ee'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            indexAxis: 'y'
        }
    });
    
    // Top Doctors Chart
    const doctorsCtx = document.getElementById('doctorsChart').getContext('2d');
    doctorsChart = new Chart(doctorsCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Potential Value',
                data: [],
                backgroundColor: '#9b59b6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Forecast Trend Chart
    const forecastTrendCtx = document.getElementById('forecastTrendChart').getContext('2d');
    forecastTrendChart = new Chart(forecastTrendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Monthly Forecast',
                data: [],
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Product Performance Chart
    const productPerformanceCtx = document.getElementById('productPerformanceChart').getContext('2d');
    productPerformanceChart = new Chart(productPerformanceCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Potential Value',
                data: [],
                backgroundColor: '#4361ee',
                borderColor: '#4361ee',
                borderWidth: 1
            }, {
                label: 'Weighted Forecast',
                data: [],
                backgroundColor: '#4cc9f0',
                borderColor: '#4cc9f0',
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
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ₹' + context.raw.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
    
    // Update all charts with data
    updateCharts();
}

// Load products from SheetDB
async function loadProducts() {
    try {
        // Try to load from SheetDB
        const response = await fetch(PRODUCT_API_URL);
        if (response.ok) {
            const data = await response.json();
            products = data.map(item => item.name);
        } else {
            // If API fails, load from localStorage as fallback
            const savedProducts = localStorage.getItem('products');
            if (savedProducts) {
                products = JSON.parse(savedProducts);
            } else {
                // Default products if nothing is available
                products = ['HOPE 10K', 'PHACO', 'ANT6000', 'ANT5000', 'A/B SCAN', 'A/B/P SCAN', 'B SCAN'];
            }
        }
        
        setupProductDropdowns();
    } catch (error) {
        console.error('Error loading products:', error);
        // Load from localStorage as fallback
        const savedProducts = localStorage.getItem('products');
        if (savedProducts) {
            products = JSON.parse(savedProducts);
            setupProductDropdowns();
        }
    }
}

// Save products to SheetDB
async function saveProducts() {
    try {
        // First save to localStorage as fallback
        localStorage.setItem('products', JSON.stringify(products));
        
        // Try to save to SheetDB
        const productData = products.map(name => ({ name }));
        
        const response = await fetch(PRODUCT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: productData
            })
        });
        
        if (!response.ok) {
            console.error('Failed to save products to SheetDB');
        }
    } catch (error) {
        console.error('Error saving products:', error);
    }
}

// Setup product dropdowns
function setupProductDropdowns() {
    const addProductDropdown = document.getElementById('addProductName');
    const editProductDropdown = document.getElementById('editProductName');
    const filterProductDropdown = document.getElementById('productFilter');
    
    // Clear existing options except the first one
    addProductDropdown.innerHTML = '<option value="">Select a product</option>';
    editProductDropdown.innerHTML = '<option value="">Select a product</option>';
    filterProductDropdown.innerHTML = '<option value="">All Products</option>';
    
    // Add products to dropdowns
    products.forEach(product => {
        addProductDropdown.innerHTML += `<option value="${product}">${product}</option>`;
        editProductDropdown.innerHTML += `<option value="${product}">${product}</option>`;
        filterProductDropdown.innerHTML += `<option value="${product}">${product}</option>`;
    });
}

// Show add product modal
function showAddProductModal() {
    document.getElementById('newProductName').value = '';
    document.getElementById('addProductModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Add new product
async function addNewProduct() {
    const newProduct = document.getElementById('newProductName').value.trim();
    
    if (!newProduct) {
        showToast('Please enter a product name', true);
        return;
    }
    
    if (products.includes(newProduct)) {
        showToast('Product already exists', true);
        return;
    }
    
    products.push(newProduct);
    await saveProducts();
    setupProductDropdowns();
    
    closeModal('addProductModal');
    showToast('Product added successfully!');
}

// Update user display
function updateUserDisplay() {
    if (currentUser) {
        document.getElementById('userDisplayName').textContent = currentUser.name;
        document.getElementById('addSalesPerson').value = currentUser.name;
    }
}

// Show toast notification
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Load records from SheetDB
async function loadRecords() {
    try {
        showLoading();
        const response = await fetch(SHEETDB_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Convert string values to numbers and ensure all fields are present
        records = data.map(record => ({
            id: record.id,
            date: record.date,
            drName: record.drName,
            hospitalName: record.hospitalName,
            // New fields
            currentUnit: record.currentUnit || '',
            place: record.place || '',
            state: record.state || '',
            phone: record.phone || '',
            email: record.email || '',
            // Existing fields
            productName: record.productName || '',
            distributorName: record.distributorName || '',
            salesPerson: record.salesPerson || '',
            pipelineStage: record.pipelineStage,
            potentialValue: parseInt(record.potentialValue) || 0,
            winningPercentage: parseInt(record.winningPercentage) || 0,
            buyingPercentage: parseInt(record.buyingPercentage) || 0,
            totalPercentage: parseInt(record.totalPercentage) || 0,
            weightedForecast: parseInt(record.weightedForecast) || 0,
            forecastMonth: record.forecastMonth,
            closedMonth: record.closedMonth || '',
            notes: record.notes || '',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        }));
        
        displayRecords();
        updateForecast();
        updateDashboard();
        populateFilters();
        hideLoading();
    } catch (error) {
        console.error('Error loading records:', error);
        showToast('Error loading data from server', true);
        hideLoading();
        
        // Load sample data if API fails
        loadSampleData();
    }
}

// Show loading indicator
function showLoading() {
    const recordsBody = document.getElementById('recordsBody');
    recordsBody.innerHTML = `
        <tr>
            <td colspan="15">
                <div class="spinner"></div>
            </td>
        </tr>
    `;
}

// Hide loading indicator
function hideLoading() {
    // Loading will be replaced when records are displayed
}

// Load sample data if API fails
function loadSampleData() {
    records = [
        {
            id: 1,
            date: '2023-05-15',
            drName: 'Dr. Sarah Johnson',
            hospitalName: 'City General Hospital',
            // New fields
            currentUnit: 'Cardiology Unit',
            place: 'Mumbai',
            state: 'Maharashtra',
            phone: '+91 9876543210',
            email: 'sarah.johnson@citygeneral.com',
            // Existing fields
            productName: 'HOPE 10K',
            distributorName: 'MedEquip Distributors',
            salesPerson: 'John Doe',
            pipelineStage: 'demo-on',
            potentialValue: 150000,
            winningPercentage: 40,
            buyingPercentage: 30,
            totalPercentage: 70,
            weightedForecast: 105000,
            forecastMonth: '2023-06',
            closedMonth: '2023-07',
            notes: 'Discussed new equipment needs. Follow up next week.',
            createdAt: '2023-05-10T08:30:00',
            updatedAt: '2023-05-14T16:45:00'
        },
        // ... (other sample records)
    ];
    
    displayRecords();
    updateForecast();
    updateDashboard();
    populateFilters();
    showToast('Loaded sample data. API connection failed.', true);
}

// Populate filter dropdowns
function populateFilters() {
    const hospitalFilter = document.getElementById('hospitalFilter');
    const productFilter = document.getElementById('productFilter');
    const distributorFilter = document.getElementById('distributorFilter');
    const salesPersonFilter = document.getElementById('salesPersonFilter');
    
    // Clear existing options except the first one
    while (hospitalFilter.options.length > 1) {
        hospitalFilter.remove(1);
    }
    
    while (productFilter.options.length > 1) {
        productFilter.remove(1);
    }
    
    while (distributorFilter.options.length > 1) {
        distributorFilter.remove(1);
    }
    
    while (salesPersonFilter.options.length > 1) {
        salesPersonFilter.remove(1);
    }
    
    const hospitals = [...new Set(records.map(record => record.hospitalName))];
    const distributors = [...new Set(records.map(record => record.distributorName))];
    const salesPersons = [...new Set(records.map(record => record.salesPerson))];
    
    hospitals.forEach(hospital => {
        const option = document.createElement('option');
        option.value = hospital;
        option.textContent = hospital;
        hospitalFilter.appendChild(option);
    });
    
    distributors.forEach(distributor => {
        if (distributor) {
            const option = document.createElement('option');
            option.value = distributor;
            option.textContent = distributor;
            distributorFilter.appendChild(option);
        }
    });
    
    salesPersons.forEach(salesPerson => {
        if (salesPerson) {
            const option = document.createElement('option');
            option.value = salesPerson;
            option.textContent = salesPerson;
            salesPersonFilter.appendChild(option);
        }
    });
}

// Search records
function searchRecords() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (!searchTerm) {
        displayRecords();
        return;
    }
    
    const filteredRecords = records.filter(record => {
        return (
            record.drName.toLowerCase().includes(searchTerm) ||
            record.hospitalName.toLowerCase().includes(searchTerm) ||
            record.productName.toLowerCase().includes(searchTerm) ||
            record.distributorName.toLowerCase().includes(searchTerm) ||
            record.salesPerson.toLowerCase().includes(searchTerm) ||
            record.pipelineStage.toLowerCase().includes(searchTerm) ||
            record.notes.toLowerCase().includes(searchTerm)
        );
    });
    
    displayFilteredRecords(filteredRecords);
}

// Update forecast percentages based on stage for add modal
function updateForecastPercentages() {
    const stage = document.getElementById('addPipelineStage').value;
    if (stage && stageProbabilities[stage]) {
        document.getElementById('addWinningPercentage').value = stageProbabilities[stage].winning;
        document.getElementById('addBuyingPercentage').value = stageProbabilities[stage].buying;
        calculateAddTotalPercentage();
    }
}

// Update forecast percentages based on stage for edit modal
function updateEditForecastPercentages() {
    const stage = document.getElementById('editPipelineStage').value;
    if (stage && stageProbabilities[stage]) {
        document.getElementById('editWinningPercentage').value = stageProbabilities[stage].winning;
        document.getElementById('editBuyingPercentage').value = stageProbabilities[stage].buying;
        calculateEditTotalPercentage();
    }
}

// Calculate total percentage for add modal
function calculateAddTotalPercentage() {
    const winningPercentage = parseFloat(document.getElementById('addWinningPercentage').value) || 0;
    const buyingPercentage = parseFloat(document.getElementById('addBuyingPercentage').value) || 0;
    const totalPercentage = (winningPercentage + buyingPercentage)/2;
    
    document.getElementById('addTotalPercentage').value = totalPercentage + '%';
    calculateAddWeightedForecast();
}

// Calculate total percentage for edit modal
function calculateEditTotalPercentage() {
    const winningPercentage = parseFloat(document.getElementById('editWinningPercentage').value) || 0;
    const buyingPercentage = parseFloat(document.getElementById('editBuyingPercentage').value) || 0;
    const totalPercentage = (winningPercentage + buyingPercentage)/2;
    
    document.getElementById('editTotalPercentage').value = totalPercentage + '%';
    calculateEditWeightedForecast();
}

// Calculate weighted forecast for add modal
function calculateAddWeightedForecast() {
    const potentialValue = parseFloat(document.getElementById('addPotentialValue').value) || 0;
    const winningPercentage = parseFloat(document.getElementById('addWinningPercentage').value) || 0;
    const buyingPercentage = parseFloat(document.getElementById('addBuyingPercentage').value) || 0;
    const totalPercentage = (winningPercentage + buyingPercentage)/2;
    const weightedForecast = (potentialValue * totalPercentage) / 100;
    
    document.getElementById('addWeightedForecast').value = formatCurrency(weightedForecast);
}

// Calculate weighted forecast for edit modal
function calculateEditWeightedForecast() {
    const potentialValue = parseFloat(document.getElementById('editPotentialValue').value) || 0;
    const winningPercentage = parseFloat(document.getElementById('editWinningPercentage').value) || 0;
    const buyingPercentage = parseFloat(document.getElementById('editBuyingPercentage').value) || 0;
    const totalPercentage = (winningPercentage + buyingPercentage)/2;
    const weightedForecast = (potentialValue * totalPercentage) / 100;
    
    document.getElementById('editWeightedForecast').value = formatCurrency(weightedForecast);
}

// Display records in the table
function displayRecords() {
    // Apply filters
    let filteredRecords = [...records];
    const stageFilter = document.getElementById('stageFilter').value;
    const hospitalFilter = document.getElementById('hospitalFilter').value;
    const productFilter = document.getElementById('productFilter').value;
    const distributorFilter = document.getElementById('distributorFilter').value;
    const salesPersonFilter = document.getElementById('salesPersonFilter').value;
    
    if (stageFilter) {
        filteredRecords = filteredRecords.filter(record => record.pipelineStage === stageFilter);
    }
    
    if (hospitalFilter) {
        filteredRecords = filteredRecords.filter(record => record.hospitalName === hospitalFilter);
    }
    
    if (productFilter) {
        filteredRecords = filteredRecords.filter(record => record.productName === productFilter);
    }
    
    if (distributorFilter) {
        filteredRecords = filteredRecords.filter(record => record.distributorName === distributorFilter);
    }
    
    if (salesPersonFilter) {
        filteredRecords = filteredRecords.filter(record => record.salesPerson === salesPersonFilter);
    }
    
    displayFilteredRecords(filteredRecords);
}

// Display filtered records
function displayFilteredRecords(filteredRecords) {
    const recordsBody = document.getElementById('recordsBody');
    const noRecords = document.getElementById('noRecords');
    
    if (filteredRecords.length === 0) {
        noRecords.style.display = 'block';
        recordsBody.innerHTML = '';
        return;
    }
    
    noRecords.style.display = 'none';
    recordsBody.innerHTML = '';
    
    filteredRecords.forEach(record => {
        const row = document.createElement('tr');
        
        // Format date for display
        const recordDate = new Date(record.date);
        const formattedDate = recordDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        // Format forecast month
        let formattedForecastMonth = '-';
        if (record.forecastMonth) {
            const forecastDate = new Date(record.forecastMonth + '-01');
            formattedForecastMonth = forecastDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short'
            });
        }
        
        // Format closed month
        let formattedClosedMonth = '-';
        if (record.closedMonth) {
            const closedDate = new Date(record.closedMonth + '-01');
            formattedClosedMonth = closedDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short'
            });
        }
        
        // Get status badge class
        let statusClass = '';
        switch(record.pipelineStage) {
            case 'prospecting': statusClass = 'status-prospecting'; break;
            case 'demo-request': statusClass = 'status-demo-request'; break;
            case 'demo-on': statusClass = 'status-demo-on'; break;
            case 'demo-completed': statusClass = 'status-demo-completed'; break;
            case 'quoted': statusClass = 'status-quoted'; break;
            case 'quote': statusClass = 'status-quote'; break;
            case 'negotiation': statusClass = 'status-negotiation'; break;
            case 'ordered': statusClass = 'status-ordered'; break;
            case 'delivered': statusClass = 'status-delivered'; break;
            case 'lost': statusClass = 'status-lost'; break;
        }
        
        // Format stage text
        const stageText = record.pipelineStage.split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        // Highlight current user's records
        const isCurrentUserRecord = record.salesPerson === currentUser.name;
        const salesPersonDisplay = isCurrentUserRecord 
            ? `<span class="salesperson-badge">${record.salesPerson}</span>` 
            : record.salesPerson;
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${record.drName}</td>
            <td>${record.hospitalName}</td>
            <!-- New fields in table -->
            <td>${record.currentUnit || '-'}</td>
            <td>${record.place || '-'}</td>
            <td>${record.state || '-'}</td>
            <td>${record.phone || '-'}</td>
            <td>${record.email || '-'}</td>
            <!-- End of new fields -->
            <td>${record.productName || '-'}</td>
            <td>${record.distributorName || '-'}</td>
            <td>${salesPersonDisplay}</td>
            <td><span class="status-badge ${statusClass}">${stageText}</span></td>
            <td>${formatCurrency(record.potentialValue)}</td>
            <td>${record.winningPercentage}%</td>
            <td>${record.buyingPercentage}%</td>
            <td>${record.totalPercentage}%</td>
            <td>${formatCurrency(record.weightedForecast)}</td>
            <td>${formattedForecastMonth}</td>
            <td>${formattedClosedMonth}</td>
            <td>
                <button class="action-btn btn-edit" onclick="openEditModal('${record.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn btn-delete" onclick="deleteRecord('${record.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        
        recordsBody.appendChild(row);
    });
}

// Open add modal
function openAddModal() {
    // Set default values
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    document.getElementById('addDate').value = `${year}-${month}-${day}`;
    document.getElementById('addForecastMonth').value = `${year}-${month}`;
    
    // Clear other fields
    document.getElementById('addDrName').value = '';
    document.getElementById('addHospitalName').value = '';
    document.getElementById('addProductName').selectedIndex = 0;
    document.getElementById('addDistributorName').value = '';
    document.getElementById('addSalesPerson').value = currentUser.name;
    document.getElementById('addPipelineStage').selectedIndex = 0;
    document.getElementById('addPotentialValue').value = '';
    document.getElementById('addWinningPercentage').value = '';
    document.getElementById('addBuyingPercentage').value = '';
    document.getElementById('addTotalPercentage').value = '';
    document.getElementById('addWeightedForecast').value = '';
    document.getElementById('addClosedMonth').value = '';
    document.getElementById('addNotes').value = '';
    
    // Clear new fields
    document.getElementById('addCurrentUnit').value = '';
    document.getElementById('addPlace').value = '';
    document.getElementById('addState').value = '';
    document.getElementById('addPhone').value = '';
    document.getElementById('addEmail').value = '';
    
    // Open modal
    document.getElementById('addModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Open edit modal with record data
function openEditModal(recordId) {
    const record = records.find(r => r.id == recordId);
    if (record) {
        document.getElementById('editRecordId').value = record.id;
        document.getElementById('editDate').value = record.date;
        document.getElementById('editDrName').value = record.drName;
        document.getElementById('editHospitalName').value = record.hospitalName;
        
        // Set new fields
        document.getElementById('editCurrentUnit').value = record.currentUnit || '';
        document.getElementById('editPlace').value = record.place || '';
        document.getElementById('editState').value = record.state || '';
        document.getElementById('editPhone').value = record.phone || '';
        document.getElementById('editEmail').value = record.email || '';
        
        // Set product
        const productSelect = document.getElementById('editProductName');
        for (let i = 0; i < productSelect.options.length; i++) {
            if (productSelect.options[i].value === record.productName) {
                productSelect.selectedIndex = i;
                break;
            }
        }
        
        document.getElementById('editDistributorName').value = record.distributorName || '';
        document.getElementById('editSalesPerson').value = record.salesPerson || '';
        document.getElementById('editPipelineStage').value = record.pipelineStage;
        document.getElementById('editPotentialValue').value = record.potentialValue;
        document.getElementById('editWinningPercentage').value = record.winningPercentage;
        document.getElementById('editBuyingPercentage').value = record.buyingPercentage;
        document.getElementById('editTotalPercentage').value = record.totalPercentage + '%';
        document.getElementById('editWeightedForecast').value = formatCurrency(record.weightedForecast);
        document.getElementById('editForecastMonth').value = record.forecastMonth;
        document.getElementById('editClosedMonth').value = record.closedMonth || '';
        document.getElementById('editNotes').value = record.notes || '';
        
        // Show update info
        if (record.updatedAt) {
            const updatedDate = new Date(record.updatedAt);
            document.getElementById('editLastUpdated').textContent = updatedDate.toLocaleString();
            document.getElementById('editUpdateDateContainer').style.display = 'block';
        } else {
            document.getElementById('editUpdateDateContainer').style.display = 'none';
        }
        
        // Open modal
        document.getElementById('editModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Add new record
async function addRecord() {
    const form = document.getElementById('addForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        showToast('Please fill all required fields', true);
        return;
    }
    
    const potentialValue = parseInt(document.getElementById('addPotentialValue').value);
    const winningPercentage = parseInt(document.getElementById('addWinningPercentage').value);
    const buyingPercentage = parseInt(document.getElementById('addBuyingPercentage').value);
    const totalPercentage = (winningPercentage + buyingPercentage)/2;
    const weightedForecast = (potentialValue * totalPercentage) / 100;
    
    const newRecord = {
        id: records.length > 0 ? Math.max(...records.map(r => parseInt(r.id))) + 1 : 1,
        date: document.getElementById('addDate').value,
        drName: document.getElementById('addDrName').value,
        hospitalName: document.getElementById('addHospitalName').value,
        // New fields
        currentUnit: document.getElementById('addCurrentUnit').value,
        place: document.getElementById('addPlace').value,
        state: document.getElementById('addState').value,
        phone: document.getElementById('addPhone').value,
        email: document.getElementById('addEmail').value,
        productName: document.getElementById('addProductName').value,
        distributorName: document.getElementById('addDistributorName').value,
        salesPerson: document.getElementById('addSalesPerson').value,
        pipelineStage: document.getElementById('addPipelineStage').value,
        potentialValue: potentialValue,
        winningPercentage: winningPercentage,
        buyingPercentage: buyingPercentage,
        totalPercentage: totalPercentage,
        weightedForecast: weightedForecast,
        forecastMonth: document.getElementById('addForecastMonth').value,
        closedMonth: document.getElementById('addClosedMonth').value,
        notes: document.getElementById('addNotes').value,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        const response = await fetch(SHEETDB_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: [newRecord]
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.created > 0) {
            records.push(newRecord);
            
            // Update UI
            displayRecords();
            updateForecast();
            updateDashboard();
            populateFilters();
            
            // Close modal
            closeModal('addModal');
            
            // Show success message
            showToast('Record added successfully!');
        } else {
            throw new Error('No records were created');
        }
    } catch (error) {
        console.error('Error adding record:', error);
        showToast('Error adding record. Please try again.', true);
    }
}

// Update record
async function updateRecord() {
    const form = document.getElementById('editForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        showToast('Please fill all required fields', true);
        return;
    }
    
    const recordId = document.getElementById('editRecordId').value;
    const recordIndex = records.findIndex(r => r.id == recordId);
    
    if (recordIndex !== -1) {
        const potentialValue = parseInt(document.getElementById('editPotentialValue').value);
        const winningPercentage = parseInt(document.getElementById('editWinningPercentage').value);
        const buyingPercentage = parseInt(document.getElementById('editBuyingPercentage').value);
        const totalPercentage = (winningPercentage + buyingPercentage)/2;
        const weightedForecast = (potentialValue * totalPercentage) / 100;
        
        const updatedRecord = {
            ...records[recordIndex],
            date: document.getElementById('editDate').value,
            drName: document.getElementById('editDrName').value,
            hospitalName: document.getElementById('editHospitalName').value,
            // New fields
            currentUnit: document.getElementById('editCurrentUnit').value,
            place: document.getElementById('editPlace').value,
            state: document.getElementById('editState').value,
            phone: document.getElementById('editPhone').value,
            email: document.getElementById('editEmail').value,
            productName: document.getElementById('editProductName').value,
            distributorName: document.getElementById('editDistributorName').value,
            salesPerson: document.getElementById('editSalesPerson').value,
            pipelineStage: document.getElementById('editPipelineStage').value,
            potentialValue: potentialValue,
            winningPercentage: winningPercentage,
            buyingPercentage: buyingPercentage,
            totalPercentage: totalPercentage,
            weightedForecast: weightedForecast,
            forecastMonth: document.getElementById('editForecastMonth').value,
            closedMonth: document.getElementById('editClosedMonth').value,
            notes: document.getElementById('editNotes').value,
            updatedAt: new Date().toISOString()
        };
        
        try {
            const response = await fetch(`${SHEETDB_API_URL}/id/${recordId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: updatedRecord
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.updated > 0) {
                records[recordIndex] = updatedRecord;
                
                // Update UI
                displayRecords();
                updateForecast();
                updateDashboard();
                
                // Close modal
                closeModal('editModal');
                
                // Show success message
                showToast('Record updated successfully!');
            } else {
                throw new Error('No records were updated');
            }
        } catch (error) {
            console.error('Error updating record:', error);
            showToast('Error updating record. Please try again.', true);
        }
    }
}

// Delete record
async function deleteRecord(recordId) {
    if (confirm('Are you sure you want to delete this record?')) {
        try {
            const response = await fetch(`${SHEETDB_API_URL}/id/${recordId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.deleted > 0) {
                records = records.filter(r => r.id != recordId);
                
                // Update UI
                displayRecords();
                updateForecast();
                updateDashboard();
                populateFilters();
                
                // Show success message
                showToast('Record deleted successfully!');
            } else {
                throw new Error('No records were deleted');
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            showToast('Error deleting record. Please try again.', true);
        }
    }
}

// Update forecast displays
function updateForecast() {
    // Calculate monthly forecast
    const monthlyForecast = calculateMonthlyForecast();
    document.getElementById('monthlyForecast').textContent = formatNumber(monthlyForecast.total);
    document.getElementById('monthlyCount').textContent = `${monthlyForecast.count} opportunities`;
    
    // Update monthly forecast details
    const monthlyDetails = document.getElementById('monthlyForecastDetails');
    monthlyDetails.innerHTML = '';
    
    Object.keys(monthlyForecast.months).sort().forEach(month => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatMonth(month)}</td>
            <td>${formatCurrency(monthlyForecast.months[month].value)}</td>
            <td>${monthlyForecast.months[month].count}</td>
        `;
        monthlyDetails.appendChild(row);
    });
    
    // Calculate quarterly forecast
    const quarterlyForecast = calculateQuarterlyForecast();
    document.getElementById('quarterlyForecast').textContent = formatNumber(quarterlyForecast.total);
    document.getElementById('quarterlyCount').textContent = `${quarterlyForecast.count} opportunities`;
    
    // Update quarterly forecast details
    const quarterlyDetails = document.getElementById('quarterlyForecastDetails');
    quarterlyDetails.innerHTML = '';
    
    Object.keys(quarterlyForecast.quarters).sort().forEach(quarter => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${quarter}</td>
            <td>${formatCurrency(quarterlyForecast.quarters[quarter].value)}</td>
            <td>${quarterlyForecast.quarters[quarter].count}</td>
        `;
        quarterlyDetails.appendChild(row);
    });
    
    // Calculate annual forecast
    const annualForecast = calculateAnnualForecast();
    document.getElementById('annualForecast').textContent = formatNumber(annualForecast.total);
    document.getElementById('annualCount').textContent = `${annualForecast.count} opportunities`;
    
    // Update annual forecast details
    const annualDetails = document.getElementById('annualForecastDetails');
    annualDetails.innerHTML = '';
    
    Object.keys(annualForecast.years).sort().forEach(year => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${year}</td>
            <td>${formatCurrency(annualForecast.years[year].value)}</td>
            <td>${annualForecast.years[year].count}</td>
        `;
        annualDetails.appendChild(row);
    });
}

// Calculate monthly forecast
function calculateMonthlyForecast() {
    const monthlyData = {};
    let total = 0;
    let count = 0;
    
    records.forEach(record => {
        // Only count records that are not lost
        if (record.pipelineStage !== 'lost') {
            const monthKey = record.forecastMonth;
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { value: 0, count: 0 };
            }
            
            // Use the weighted forecast value
            monthlyData[monthKey].value += record.weightedForecast;
            monthlyData[monthKey].count += 1;
            total += record.weightedForecast;
            count += 1;
        }
    });
    
    return { total, count, months: monthlyData };
}

// Calculate quarterly forecast
function calculateQuarterlyForecast() {
    const quarterlyData = {};
    let total = 0;
    let count = 0;
    
    records.forEach(record => {
        // Only count records that are not lost
        if (record.pipelineStage !== 'lost') {
            const month = record.forecastMonth;
            const year = month.split('-')[0];
            const monthNum = parseInt(month.split('-')[1]);
            const quarter = `Q${Math.floor((monthNum - 1) / 3) + 1} ${year}`;
            
            if (!quarterlyData[quarter]) {
                quarterlyData[quarter] = { value: 0, count: 0 };
            }
            
            // Use the weighted forecast value
            quarterlyData[quarter].value += record.weightedForecast;
            quarterlyData[quarter].count += 1;
            total += record.weightedForecast;
            count += 1;
        }
    });
    
    return { total, count, quarters: quarterlyData };
}

// Calculate annual forecast
function calculateAnnualForecast() {
    const annualData = {};
    let total = 0;
    let count = 0;
    
    records.forEach(record => {
        // Only count records that are not lost
        if (record.pipelineStage !== 'lost') {
            const year = record.forecastMonth.split('-')[0];
            
            if (!annualData[year]) {
                annualData[year] = { value: 0, count: 0 };
            }
            
            // Use the weighted forecast value
            annualData[year].value += record.weightedForecast;
            annualData[year].count += 1;
            total += record.weightedForecast;
            count += 1;
        }
    });
    
    return { total, count, years: annualData };
}

// Format month for display (e.g., "2023-06" -> "June 2023")
function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Format currency for display
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// Format number for display (without currency symbol)
function formatNumber(amount) {
    return new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0
    }).format(amount);
}

// Update dashboard KPIs and charts
function updateDashboard() {
    updateKPIs();
    updateCharts();
}

// Update Key Performance Indicators
function updateKPIs() {
    // Total Pipeline Value
    const totalValue = records.reduce((sum, record) => sum + record.potentialValue, 0);
    document.getElementById('kpi-total-value').textContent = formatCurrency(totalValue);
    document.getElementById('kpi-total-change').textContent = `${records.length} Opportunities`;
    
    // Weighted Forecast
    const weightedForecast = records.reduce((sum, record) => sum + record.weightedForecast, 0);
    document.getElementById('kpi-weighted-forecast').textContent = formatCurrency(weightedForecast);
    const forecastPercentage = totalValue > 0 ? (weightedForecast / totalValue * 100).toFixed(1) : 0;
    document.getElementById('kpi-forecast-change').textContent = `${forecastPercentage}% of Pipeline`;
    
    // Win Rate (only for closed deals)
    const won = records.filter(r => ['ordered', 'delivered'].includes(r.pipelineStage)).length;
    const lost = records.filter(r => r.pipelineStage === 'lost').length;
    const winRate = won + lost > 0 ? (won / (won + lost) * 100).toFixed(1) : 0;
    document.getElementById('kpi-win-rate').textContent = `${winRate}%`;
    document.getElementById('kpi-win-change').textContent = `Based on ${won + lost} deals`;
    
    // Average Deal Size
    const avgDeal = records.length > 0 ? totalValue / records.length : 0;
    document.getElementById('kpi-avg-deal').textContent = formatCurrency(avgDeal);
    document.getElementById('kpi-deal-change').textContent = 'Across all stages';
}

// Update all charts with current data
function updateCharts() {
    updatePipelineStageChart();
    updateMonthlyTrendChart();
    updateHospitalValueChart();
    updateDoctorsChart();
    updateForecastTrendChart();
    updateProductPerformanceChart(calculateProductForecast());
}

// Update Pipeline Stage Chart
function updatePipelineStageChart() {
    const stageCounts = {
        'prospecting': 0,
        'demo-request': 0,
        'demo-on': 0,
        'demo-completed': 0,
        'quoted': 0,
        'quote': 0,
        'negotiation': 0,
        'ordered': 0,
        'delivered': 0,
        'lost': 0
    };
    
    records.forEach(record => {
        stageCounts[record.pipelineStage]++;
    });
    
    pipelineStageChart.data.datasets[0].data = [
        stageCounts['prospecting'],
        stageCounts['demo-request'],
        stageCounts['demo-on'],
        stageCounts['demo-completed'],
        stageCounts['quoted'],
        stageCounts['quote'],
        stageCounts['negotiation'],
        stageCounts['ordered'],
        stageCounts['delivered'],
        stageCounts['lost']
    ];
    
    pipelineStageChart.update();
}

// Update Monthly Trend Chart
function updateMonthlyTrendChart() {
    // Group by month
    const monthlyData = {};
    const monthlyForecast = {};
    
    records.forEach(record => {
        const month = record.forecastMonth; // YYYY-MM format
        
        if (!monthlyData[month]) {
            monthlyData[month] = 0;
            monthlyForecast[month] = 0;
        }
        
        monthlyData[month] += record.potentialValue;
        monthlyForecast[month] += record.weightedForecast;
    });
    
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort();
    const monthLabels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    
    const values = sortedMonths.map(month => monthlyData[month]);
    const forecasts = sortedMonths.map(month => monthlyForecast[month]);
    
    monthlyTrendChart.data.labels = monthLabels;
    monthlyTrendChart.data.datasets[0].data = values;
    monthlyTrendChart.data.datasets[1].data = forecasts;
    monthlyTrendChart.update();
}

// Update Hospital Value Chart
function updateHospitalValueChart() {
    const hospitalData = {};
    
    records.forEach(record => {
        if (!hospitalData[record.hospitalName]) {
            hospitalData[record.hospitalName] = 0;
        }
        
        hospitalData[record.hospitalName] += record.potentialValue;
    });
    
    // Sort by value and take top 10
    const sortedHospitals = Object.entries(hospitalData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    hospitalValueChart.data.labels = sortedHospitals.map(item => item[0]);
    hospitalValueChart.data.datasets[0].data = sortedHospitals.map(item => item[1]);
    hospitalValueChart.update();
}

// Update Doctors Chart
function updateDoctorsChart() {
    const doctorData = {};
    
    records.forEach(record => {
        if (!doctorData[record.drName]) {
            doctorData[record.drName] = 0;
        }
        
        doctorData[record.drName] += record.potentialValue;
    });
    
    // Sort by value and take top 10
    const sortedDoctors = Object.entries(doctorData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    doctorsChart.data.labels = sortedDoctors.map(item => item[0]);
    doctorsChart.data.datasets[0].data = sortedDoctors.map(item => item[1]);
    doctorsChart.update();
}

// Update Forecast Trend Chart
function updateForecastTrendChart() {
    const monthlyForecast = calculateMonthlyForecast();
    
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyForecast.months).sort();
    const monthLabels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    
    const values = sortedMonths.map(month => monthlyForecast.months[month].value);
    
    forecastTrendChart.data.labels = monthLabels;
    forecastTrendChart.data.datasets[0].data = values;
    forecastTrendChart.update();
}

// Open edit profile modal
function openEditProfileModal() {
    document.getElementById('editProfileName').value = currentUser.name;
    document.getElementById('editProfileEmail').value = currentUser.email;
    document.getElementById('editProfilePassword').value = '';
    document.getElementById('editProfileConfirmPassword').value = '';
    
    document.getElementById('editProfileModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Update profile
async function updateProfile() {
    const name = document.getElementById('editProfileName').value;
    const email = document.getElementById('editProfileEmail').value;
    const password = document.getElementById('editProfilePassword').value;
    const confirmPassword = document.getElementById('editProfileConfirmPassword').value;

    // Validate passwords match if provided
    if (password && password !== confirmPassword) {
        showToast('Passwords do not match', true);
        return;
    }
    
    try {
        // Update user data
        const updatedUser = {
            ...currentUser,
            name: name,
            email: email
        };
        
        // Update password if provided
        if (password) {
            updatedUser.password = password;
        }
        
        // Update in the database
        const response = await fetch(`${USER_API_URL}/id/${currentUser.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: updatedUser
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.updated > 0) {
            // Update current user in localStorage
            currentUser = updatedUser;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Update UI
            updateUserDisplay();
            
            closeModal('editProfileModal');
            showToast('Profile updated successfully!');
        } else {
            throw new Error('Profile update failed');
        }
    } catch (error) {
        console.error('Profile update error:', error);
        showToast('Error updating profile. Please try again.', true);
    }
}

// Logout function
function logout() {
    // Clear user data from localStorage
    localStorage.removeItem('currentUser');
    
    // Redirect to login page
    window.location.href = 'index.html';
}