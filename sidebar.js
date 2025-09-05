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
            emailDomainInput: document.getElementById('emailDomainInput'),
            emailSuggestions: document.getElementById('emailSuggestions'),
            emailList: document.getElementById('emailList')
        };
    }

    setupEventListeners() {
        this.elements.scanButton.addEventListener('click', () => {
            this.scanProfile();
        });

        // Listen for name and email domain input changes to generate email suggestions
        this.elements.nameInput.addEventListener('input', () => {
            this.generateEmailSuggestions();
        });

        this.elements.emailDomainInput.addEventListener('input', () => {
            this.generateEmailSuggestions();
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

    generateEmailSuggestions() {
        const name = this.elements.nameInput.value.trim();
        const domain = this.elements.emailDomainInput.value.trim();

        // Hide suggestions if either field is empty
        if (!name || !domain) {
            this.elements.emailSuggestions.style.display = 'none';
            return;
        }

        // Parse the name into first and last names
        const nameParts = name.split(/\s+/).filter(part => part.length > 0);
        if (nameParts.length < 2) {
            // Need at least first and last name
            this.elements.emailSuggestions.style.display = 'none';
            return;
        }

        const firstName = nameParts[0].toLowerCase();
        const lastName = nameParts[nameParts.length - 1].toLowerCase();

        // Clean the domain (remove @ if present, trim spaces)
        const cleanDomain = domain.replace('@', '').trim();
        
        if (!cleanDomain) {
            this.elements.emailSuggestions.style.display = 'none';
            return;
        }

        // Generate the three email formats
        const emailFormats = [
            `${firstName}@${cleanDomain}`,
            `${firstName}.${lastName}@${cleanDomain}`,
            `${firstName}${lastName}@${cleanDomain}`
        ];

        // Update the UI
        this.displayEmailSuggestions(emailFormats);
    }

    displayEmailSuggestions(emails) {
        // Clear existing suggestions
        this.elements.emailList.innerHTML = '';

        // Create email suggestion elements
        emails.forEach((email, index) => {
            const emailItem = document.createElement('div');
            emailItem.className = 'email-item';
            emailItem.setAttribute('data-email', email);
            
            const emailText = document.createElement('span');
            emailText.className = 'email-text';
            emailText.textContent = email;
            
            const statusIndicator = document.createElement('span');
            statusIndicator.className = 'verification-status';
            statusIndicator.innerHTML = '❓';
            statusIndicator.title = 'Not verified';
            
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';
            
            const verifyButton = document.createElement('button');
            verifyButton.className = 'verify-button';
            verifyButton.innerHTML = '✓';
            verifyButton.title = 'Verify email';
            verifyButton.addEventListener('click', () => {
                this.verifyEmail(email, emailItem);
            });
            
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.innerHTML = '📋';
            copyButton.title = 'Copy to clipboard';
            copyButton.addEventListener('click', () => {
                this.copyToClipboard(email, copyButton);
            });

            buttonContainer.appendChild(verifyButton);
            buttonContainer.appendChild(copyButton);
            
            emailItem.appendChild(emailText);
            emailItem.appendChild(statusIndicator);
            emailItem.appendChild(buttonContainer);
            this.elements.emailList.appendChild(emailItem);
        });

        // Add verify all button
        const verifyAllContainer = document.createElement('div');
        verifyAllContainer.className = 'verify-all-container';
        
        const verifyAllButton = document.createElement('button');
        verifyAllButton.className = 'verify-all-button';
        verifyAllButton.innerHTML = '🔍 Verify All Emails';
        verifyAllButton.title = 'Verify all email addresses';
        verifyAllButton.addEventListener('click', () => {
            this.verifyAllEmails(emails);
        });
        
        verifyAllContainer.appendChild(verifyAllButton);
        this.elements.emailList.appendChild(verifyAllContainer);

        // Show the suggestions section
        this.elements.emailSuggestions.style.display = 'block';
    }

    async copyToClipboard(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            
            // Visual feedback
            const originalText = button.innerHTML;
            button.innerHTML = '✅';
            button.style.backgroundColor = '#28a745';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.backgroundColor = '';
            }, 1000);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            // Visual feedback
            const originalText = button.innerHTML;
            button.innerHTML = '✅';
            button.style.backgroundColor = '#28a745';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.backgroundColor = '';
            }, 1000);
        }
    }

    async verifyEmail(email, emailItem) {
        const statusIndicator = emailItem.querySelector('.verification-status');
        const verifyButton = emailItem.querySelector('.verify-button');
        
        // Set loading state
        statusIndicator.innerHTML = '⏳';
        statusIndicator.title = 'Verifying...';
        statusIndicator.className = 'verification-status loading';
        verifyButton.disabled = true;
        
        try {
            const result = await this.callNeverBounceAPI(email);
            this.updateVerificationStatus(statusIndicator, verifyButton, result);
        } catch (error) {
            console.error('Email verification failed:', error);
            statusIndicator.innerHTML = '❌';
            statusIndicator.title = `Verification failed: ${error.message}`;
            statusIndicator.className = 'verification-status error';
            verifyButton.disabled = false;
        }
    }

    async verifyAllEmails(emails) {
        const verifyAllButton = document.querySelector('.verify-all-button');
        verifyAllButton.disabled = true;
        verifyAllButton.innerHTML = '⏳ Verifying...';
        
        try {
            // Verify all emails concurrently
            const verificationPromises = emails.map(email => {
                const emailItem = document.querySelector(`[data-email="${email}"]`);
                return this.verifyEmail(email, emailItem);
            });
            
            await Promise.all(verificationPromises);
            
            verifyAllButton.innerHTML = '✅ All Verified';
            setTimeout(() => {
                verifyAllButton.innerHTML = '🔍 Verify All Emails';
                verifyAllButton.disabled = false;
            }, 2000);
        } catch (error) {
            console.error('Bulk verification failed:', error);
            verifyAllButton.innerHTML = '❌ Verification Failed';
            setTimeout(() => {
                verifyAllButton.innerHTML = '🔍 Verify All Emails';
                verifyAllButton.disabled = false;
            }, 2000);
        }
    }

    async callNeverBounceAPI(email) {
        const API_KEY = 'private_658ac1a2ad10d7c6361d1391903ea93c';
        const API_URL = 'https://api.neverbounce.com/v4/single/check';
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: API_KEY,
                email: email
            })
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.status !== 'success') {
            throw new Error(data.message || 'API returned error status');
        }
        
        return data;
    }

    updateVerificationStatus(statusIndicator, verifyButton, result) {
        verifyButton.disabled = false;
        
        switch (result.result) {
            case 'valid':
                statusIndicator.innerHTML = '✅';
                statusIndicator.title = `Valid email - Execution time: ${result.execution_time}ms`;
                statusIndicator.className = 'verification-status valid';
                break;
            case 'invalid':
                statusIndicator.innerHTML = '❌';
                statusIndicator.title = `Invalid email - Execution time: ${result.execution_time}ms`;
                statusIndicator.className = 'verification-status invalid';
                break;
            case 'disposable':
                statusIndicator.innerHTML = '🗑️';
                statusIndicator.title = `Disposable email - Execution time: ${result.execution_time}ms`;
                statusIndicator.className = 'verification-status disposable';
                break;
            case 'catchall':
                statusIndicator.innerHTML = '📧';
                statusIndicator.title = `Catch-all email - Execution time: ${result.execution_time}ms`;
                statusIndicator.className = 'verification-status catchall';
                break;
            case 'unknown':
                statusIndicator.innerHTML = '❓';
                statusIndicator.title = `Unknown status - Execution time: ${result.execution_time}ms`;
                statusIndicator.className = 'verification-status unknown';
                break;
            default:
                statusIndicator.innerHTML = '❓';
                statusIndicator.title = `Unexpected result: ${result.result}`;
                statusIndicator.className = 'verification-status unknown';
        }
        
        // Add flags information to title if available
        if (result.flags && result.flags.length > 0) {
            const currentTitle = statusIndicator.title;
            statusIndicator.title = `${currentTitle}\nFlags: ${result.flags.join(', ')}`;
        }
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
