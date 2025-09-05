// LinkedIn Lead Generator - Sidebar Script
class LeadGeneratorSidebar {
    constructor() {
        this.elements = {};
        this.currentTabId = null;
        this.isScanning = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkCurrentTab();
        this.initializeCache();
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
        statusIndicator.title = 'Checking...';
        statusIndicator.className = 'verification-status loading';
        verifyButton.disabled = true;
        
        try {
            // First, check cache
            const cachedResult = await this.getCachedVerification(email);
            
            if (cachedResult) {
                console.log('Using cached verification result for:', email);
                this.updateVerificationStatus(statusIndicator, verifyButton, cachedResult, true);
                return;
            }
            
            // If not in cache, make API call
            statusIndicator.title = 'Verifying via API...';
            const result = await this.callNeverBounceAPI(email);
            
            // Cache the result
            await this.setCachedVerification(email, result);
            
            this.updateVerificationStatus(statusIndicator, verifyButton, result, false);
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

    updateVerificationStatus(statusIndicator, verifyButton, result, fromCache = false) {
        verifyButton.disabled = false;
        
        const cacheIndicator = fromCache ? ' 💾' : '';
        const sourceText = fromCache ? 'from cache' : `API - ${result.execution_time}ms`;
        
        switch (result.result) {
            case 'valid':
                statusIndicator.innerHTML = `✅${cacheIndicator}`;
                statusIndicator.title = `Valid email (${sourceText})`;
                statusIndicator.className = 'verification-status valid';
                break;
            case 'invalid':
                statusIndicator.innerHTML = `❌${cacheIndicator}`;
                statusIndicator.title = `Invalid email (${sourceText})`;
                statusIndicator.className = 'verification-status invalid';
                break;
            case 'disposable':
                statusIndicator.innerHTML = `🗑️${cacheIndicator}`;
                statusIndicator.title = `Disposable email (${sourceText})`;
                statusIndicator.className = 'verification-status disposable';
                break;
            case 'catchall':
                statusIndicator.innerHTML = `📧${cacheIndicator}`;
                statusIndicator.title = `Catch-all email (${sourceText})`;
                statusIndicator.className = 'verification-status catchall';
                break;
            case 'unknown':
                statusIndicator.innerHTML = `❓${cacheIndicator}`;
                statusIndicator.title = `Unknown status (${sourceText})`;
                statusIndicator.className = 'verification-status unknown';
                break;
            default:
                statusIndicator.innerHTML = `❓${cacheIndicator}`;
                statusIndicator.title = `Unexpected result: ${result.result} (${sourceText})`;
                statusIndicator.className = 'verification-status unknown';
        }
        
        // Add flags information to title if available
        if (result.flags && result.flags.length > 0) {
            const currentTitle = statusIndicator.title;
            statusIndicator.title = `${currentTitle}\nFlags: ${result.flags.join(', ')}`;
        }
    }

    // Email verification cache management
    async getCachedVerification(email) {
        try {
            const cacheKey = `email_verification_${email.toLowerCase()}`;
            const result = await chrome.storage.local.get(cacheKey);
            
            if (result[cacheKey]) {
                const cachedData = result[cacheKey];
                const now = Date.now();
                const cacheAge = now - cachedData.timestamp;
                
                console.log(`Cache hit for ${email} (cached ${Math.round(cacheAge / 1000 / 60)} minutes ago)`);
                return cachedData.verification;
            }
            
            console.log(`Cache miss for ${email}`);
            return null;
        } catch (error) {
            console.error('Error reading from cache:', error);
            return null;
        }
    }

    async setCachedVerification(email, verificationResult) {
        try {
            const cacheKey = `email_verification_${email.toLowerCase()}`;
            const cacheData = {
                email: email.toLowerCase(),
                verification: verificationResult,
                timestamp: Date.now()
            };
            
            await chrome.storage.local.set({ [cacheKey]: cacheData });
            console.log(`Cached verification result for ${email}`);
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }

    async removeCachedVerification(email) {
        try {
            const cacheKey = `email_verification_${email.toLowerCase()}`;
            await chrome.storage.local.remove(cacheKey);
            console.log(`Removed cached verification for ${email}`);
        } catch (error) {
            console.error('Error removing from cache:', error);
        }
    }

    async cleanupExpiredCache() {
        // No longer needed - cache entries are stored permanently
        console.log('Cache cleanup disabled - entries are stored permanently');
    }

    async getCacheStats() {
        try {
            const allStorage = await chrome.storage.local.get();
            const verificationKeys = Object.keys(allStorage).filter(key => 
                key.startsWith('email_verification_')
            );
            
            const stats = {
                totalEntries: verificationKeys.length,
                newestEntry: 0,
                oldestEntry: Date.now()
            };
            
            for (const key of verificationKeys) {
                const timestamp = allStorage[key].timestamp;
                if (timestamp > stats.newestEntry) stats.newestEntry = timestamp;
                if (timestamp < stats.oldestEntry) stats.oldestEntry = timestamp;
            }
            
            return stats;
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return { totalEntries: 0, newestEntry: 0, oldestEntry: 0 };
        }
    }

    async initializeCache() {
        try {
            const stats = await this.getCacheStats();
            console.log(`📊 Email Verification Cache Stats (Permanent Storage):`, {
                'Total cached emails': stats.totalEntries,
                'Newest entry': stats.newestEntry ? new Date(stats.newestEntry).toLocaleString() : 'None',
                'Oldest entry': stats.oldestEntry < Date.now() ? new Date(stats.oldestEntry).toLocaleString() : 'None'
            });
        } catch (error) {
            console.error('Error initializing cache:', error);
        }
    }

    async clearAllCache() {
        try {
            const allStorage = await chrome.storage.local.get();
            const verificationKeys = Object.keys(allStorage).filter(key => 
                key.startsWith('email_verification_')
            );
            
            if (verificationKeys.length > 0) {
                await chrome.storage.local.remove(verificationKeys);
                console.log(`🗑️ Cleared ${verificationKeys.length} cached verification entries`);
                return verificationKeys.length;
            } else {
                console.log('No cache entries to clear');
                return 0;
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
            return 0;
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
let leadGeneratorSidebar;

document.addEventListener('DOMContentLoaded', () => {
    leadGeneratorSidebar = new LeadGeneratorSidebar();
    
    // Expose cache management functions to the global scope for debugging
    window.leadGeneratorDebug = {
        getCacheStats: () => leadGeneratorSidebar.getCacheStats(),
        clearCache: () => leadGeneratorSidebar.clearAllCache(),
        removeCachedEmail: (email) => leadGeneratorSidebar.removeCachedVerification(email)
    };
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        leadGeneratorSidebar = new LeadGeneratorSidebar();
        
        // Expose cache management functions to the global scope for debugging
        window.leadGeneratorDebug = {
            getCacheStats: () => leadGeneratorSidebar.getCacheStats(),
            clearCache: () => leadGeneratorSidebar.clearAllCache(),
            removeCachedEmail: (email) => leadGeneratorSidebar.removeCachedVerification(email)
        };
    });
} else {
    leadGeneratorSidebar = new LeadGeneratorSidebar();
    
    // Expose cache management functions to the global scope for debugging
    window.leadGeneratorDebug = {
        getCacheStats: () => leadGeneratorSidebar.getCacheStats(),
        clearCache: () => leadGeneratorSidebar.clearAllCache(),
        removeCachedEmail: (email) => leadGeneratorSidebar.removeCachedVerification(email)
    };
}
