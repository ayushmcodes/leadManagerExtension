// LinkedIn Lead Generator - Sidebar Script
class LeadGeneratorSidebar {
    constructor() {
        this.elements = {};
        this.currentTabId = null;
        this.isScanning = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkCurrentTab();
    }

    initializeElements() {
        this.elements = {
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            profileCard: document.getElementById('profileCard'),
            profileName: document.getElementById('profileName'),
            scanButton: document.getElementById('scanButton'),
            errorMessage: document.getElementById('errorMessage'),
            errorText: document.getElementById('errorText'),
            nameInput: document.getElementById('nameInput'),
            companyInput: document.getElementById('companyInput'),
            emailDomainInput: document.getElementById('emailDomainInput')
        };
    }

    setupEventListeners() {
        this.elements.scanButton.addEventListener('click', () => {
            this.scanProfile();
        });

        // Listen for tab changes
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.currentTabId = activeInfo.tabId;
            this.checkCurrentTab();
        });

        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.checkCurrentTab();
            }
        });
    }

    async checkCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTabId = tab?.id;
            
            if (tab && tab.url && tab.url.includes('linkedin.com/in/')) {
                this.updateStatus('LinkedIn profile detected', 'ready');
                this.elements.scanButton.disabled = false;
                this.hideError();
            } else {
                this.updateStatus('Navigate to a LinkedIn profile', 'waiting');
                this.elements.scanButton.disabled = true;
                this.hideProfileCard();
            }
        } catch (error) {
            console.error('Error checking current tab:', error);
            this.updateStatus('Error checking tab', 'error');
        }
    }

    async scanProfile() {
        if (this.isScanning) return;
        
        this.isScanning = true;
        this.updateStatus('Extracting name...', 'scanning');
        this.elements.scanButton.disabled = true;
        this.hideError();
        this.hideProfileCard();

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.url || !tab.url.includes('linkedin.com/in/')) {
                throw new Error('Please navigate to a LinkedIn profile page');
            }

            // Send message to content script to extract profile data
            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'extractProfile' 
            });

            if (response.success) {
                this.displayProfile(response.data);
                this.updateStatus('Name extracted successfully', 'ready');
            } else {
                throw new Error(response.error || 'Failed to extract profile data');
            }
        } catch (error) {
            console.error('Scan error:', error);
            this.showError(error.message || 'Failed to extract name. Please try again.');
            this.updateStatus('Name extraction failed', 'error');
        } finally {
            this.isScanning = false;
            this.elements.scanButton.disabled = false;
        }
    }

    displayProfile(data) {
        // Update profile name
        this.elements.profileName.textContent = data.name || 'Name not found';

        // Auto-fill the name input field
        if (data.name) {
            this.elements.nameInput.value = data.name;
        }

        // Show profile card with animation
        this.elements.profileCard.style.display = 'block';
        this.elements.profileCard.classList.add('fade-in');
        
        // Remove animation class after animation completes
        setTimeout(() => {
            this.elements.profileCard.classList.remove('fade-in');
        }, 300);
    }

    updateStatus(text, type = 'ready') {
        this.elements.statusText.textContent = text;
        
        // Remove all status classes
        this.elements.statusIndicator.classList.remove('scanning', 'error', 'ready');
        
        // Add appropriate class
        if (type === 'scanning') {
            this.elements.statusIndicator.classList.add('scanning');
        } else if (type === 'error') {
            this.elements.statusIndicator.classList.add('error');
        }
    }

    showError(message) {
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.style.display = 'flex';
    }

    hideError() {
        this.elements.errorMessage.style.display = 'none';
    }

    hideProfileCard() {
        this.elements.profileCard.style.display = 'none';
    }

    // Form data utility methods
    getFormData() {
        return {
            name: this.elements.nameInput.value.trim(),
            company: this.elements.companyInput.value.trim(),
            emailDomain: this.elements.emailDomainInput.value.trim()
        };
    }

    setFormData(data) {
        if (data.name) this.elements.nameInput.value = data.name;
        if (data.company) this.elements.companyInput.value = data.company;
        if (data.emailDomain) this.elements.emailDomainInput.value = data.emailDomain;
    }

    clearForm() {
        this.elements.nameInput.value = '';
        this.elements.companyInput.value = '';
        this.elements.emailDomainInput.value = '';
    }

    validateForm() {
        const data = this.getFormData();
        const errors = [];

        if (!data.name) errors.push('Name is required');
        if (!data.company) errors.push('Company name is required');
        if (data.emailDomain && !data.emailDomain.includes('@')) {
            errors.push('Email domain should include @ (e.g., @company.com)');
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            data: data
        };
    }
}

// Initialize the sidebar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LeadGeneratorSidebar();
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new LeadGeneratorSidebar();
    });
} else {
    new LeadGeneratorSidebar();
}
