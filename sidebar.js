// LinkedIn Lead Generator - Sidebar Script
class LeadGeneratorSidebar {
    constructor() {
        this.elements = {};
        this.currentTabId = null;
        this.isScanning = false;
        this.cacheServerUrl = 'http://localhost:3001'; // Go Redis Cache Server
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkCurrentTab();
        this.initializeCache();
        this.initializeLeadsCounter();
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
            listNameInput: document.getElementById('listNameInput'),
            customEmailInput: document.getElementById('customEmailInput'),
            saveEmailButton: document.getElementById('saveEmailButton'),
            emailSuggestions: document.getElementById('emailSuggestions'),
            emailList: document.getElementById('emailList'),
            leadsCounter: document.getElementById('leadsCounter'),
            validUnexportedCount: document.getElementById('validUnexportedCount'),
            counterStatus: document.getElementById('counterStatus'),
            refreshLeadsBtn: document.getElementById('refreshLeadsBtn'),
            listBreakdown: document.getElementById('listBreakdown'),
            breakdownContent: document.getElementById('breakdownContent')
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

        this.elements.companyInput.addEventListener('input', () => {
            this.generateEmailSuggestions();
        });

        this.elements.emailDomainInput.addEventListener('input', () => {
            this.generateEmailSuggestions();
        });

        // Listen for leads counter refresh
        this.elements.refreshLeadsBtn.addEventListener('click', () => {
            this.refreshLeadsCount();
        });

        // Listen for save custom email button
        this.elements.saveEmailButton.addEventListener('click', () => {
            this.saveCustomEmail();
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
        console.log("generateEmailSuggestions")
        const name = this.elements.nameInput.value.trim();
        const companyName = this.elements.companyInput.value.trim();
        const domain = this.elements.emailDomainInput.value.trim();
        const listName = this.elements.listNameInput.value.trim();

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
        const cleanDomain = domain.replace('@', '').trim().toLowerCase();
        
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

        const leadData = {
            firstName: firstName,
            lastName: lastName,
            companyName: companyName,
            domain: cleanDomain,
            listLeadBelongsTo: listName,
            possibleEmails: emailFormats
        }

        console.log("leadData")
        console.log(leadData)

        // Update the UI
        this.displayEmailSuggestions(leadData);
    }

    displayEmailSuggestions(leadData) {
        console.log("insidedisplayEmailSuggestions")
        var emails = leadData.possibleEmails;
        console.log("emails")
        console.log(emails)
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
                this.verifyEmail(email, emailItem,leadData);
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
            this.verifyAllEmails(emails,leadData);
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

    async verifyEmail(email, emailItem,leadData) {
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
                const result={
                    result: cachedResult.emailStatus
                }
                this.updateVerificationStatus(statusIndicator, verifyButton, result, true);
                return;
            }
            
            // If not in cache, make API call
            statusIndicator.title = 'Verifying via API...';
            
            var dataToBeStoredInCache={
                firstName:leadData.firstName,
                lastName:leadData.lastName,
                companyName:leadData.companyName,
                domain:leadData.domain,
                email:email,
                listLeadBelongsTo:leadData.listLeadBelongsTo
            }
            const result = await this.callNeverBounceAPI(email);
            dataToBeStoredInCache.emailStatus=result.result;
            console.log("dataToBeStoredInCache")
            console.log(dataToBeStoredInCache)
            // Cache the result
            await this.setCachedVerification(email, dataToBeStoredInCache);
            
            this.updateVerificationStatus(statusIndicator, verifyButton, result, false);
        } catch (error) {
            console.error('Email verification failed:', error);
            statusIndicator.innerHTML = '❌';
            statusIndicator.title = `Verification failed: ${error.message}`;
            statusIndicator.className = 'verification-status error';
            verifyButton.disabled = false;
        }
    }

    async verifyAllEmails(emails,leadData) {
        const verifyAllButton = document.querySelector('.verify-all-button');
        verifyAllButton.disabled = true;
        verifyAllButton.innerHTML = '⏳ Verifying...';
        
        try {
            // Verify all emails concurrently
            const verificationPromises = emails.map(email => {
                const emailItem = document.querySelector(`[data-email="${email}"]`);
                return this.verifyEmail(email, emailItem,leadData);
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
        const sourceText = fromCache ? 'from cache' : 'from API';
        
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
    }

    // Email verification cache management via Go Redis server
    async getCachedVerification(email) {
        try {
            const response = await fetch(`${this.cacheServerUrl}/cache/${encodeURIComponent(email.toLowerCase())}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.cached && result.data) {
                console.log(`✅ Redis cache hit for ${email} (cached ${Math.round(result.cacheAge / 1000 / 60)} minutes ago)`);
                return result.data;
            }
            
            console.log(`❌ Redis cache miss for ${email}`);
            return null;
        } catch (error) {
            console.error('❌ Error reading from Go cache server:', error);
            // Fallback to Chrome storage if Go server is unavailable
            return await this.getCachedVerificationFallback(email);
        }
    }

    async setCachedVerification(email, verificationResult) {
        try {
            const response = await fetch(`${this.cacheServerUrl}/cache/${encodeURIComponent(email.toLowerCase())}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(verificationResult)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ Cached verification result for ${email} in Go Redis server`);
            } else {
                console.error('❌ Failed to cache verification result:', result.error);
            }
        } catch (error) {
            console.error('❌ Error saving to Go cache server:', error);
            // Fallback to Chrome storage if Go server is unavailable
            await this.setCachedVerificationFallback(email, verificationResult);
        }
    }

    async removeCachedVerification(email) {
        try {
            const response = await fetch(`${this.cacheServerUrl}/cache/${encodeURIComponent(email.toLowerCase())}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ Removed cached verification for ${email} from Go Redis server`);
            }
        } catch (error) {
            console.error('❌ Error removing from Go cache server:', error);
            // Fallback to Chrome storage if Go server is unavailable
            await this.removeCachedVerificationFallback(email);
        }
    }

    async cleanupExpiredCache() {
        // No longer needed - cache entries are stored permanently
        console.log('Cache cleanup disabled - entries are stored permanently');
    }

    async getCacheStats() {
        try {
            const response = await fetch(`${this.cacheServerUrl}/stats`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                return {
                    totalEntries: result.stats.totalEntries,
                    newestEntry: result.stats.newestEntry,
                    oldestEntry: result.stats.oldestEntry
                };
            }
            
            return { totalEntries: 0, newestEntry: 0, oldestEntry: 0 };
        } catch (error) {
            console.error('❌ Error getting cache stats from Go server:', error);
            // Fallback to Chrome storage if Go server is unavailable
            return await this.getCacheStatsFallback();
        }
    }

    async initializeCache() {
        try {
            // Check if Go cache server is available
            const healthResponse = await fetch(`${this.cacheServerUrl}/health`);
            
            if (healthResponse.ok) {
                const health = await healthResponse.json();
                console.log('✅ Go Redis cache server is connected:', health);
                
                const stats = await this.getCacheStats();
                console.log(`📊 Email Verification Cache Stats (Redis via Go):`, {
                    'Total cached emails': stats.totalEntries,
                    'Newest entry': stats.newestEntry ? new Date(stats.newestEntry).toLocaleString() : 'None',
                    'Oldest entry': stats.oldestEntry < Date.now() ? new Date(stats.oldestEntry).toLocaleString() : 'None'
                });
            } else {
                console.warn('⚠️ Go cache server not available, falling back to Chrome storage');
                await this.initializeCacheFallback();
            }
        } catch (error) {
            console.error('❌ Error connecting to Go cache server:', error);
            console.warn('⚠️ Falling back to Chrome storage mode');
            await this.initializeCacheFallback();
        }
    }

    async clearAllCache() {
        try {
            const response = await fetch(`${this.cacheServerUrl}/cache`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ Cleared ${result.deletedCount} cached verification entries from Go Redis server`);
                return result.deletedCount;
            }
            
            return 0;
        } catch (error) {
            console.error('❌ Error clearing cache from Go server:', error);
            // Fallback to Chrome storage if Go server is unavailable
            return await this.clearAllCacheFallback();
        }
    }

    // Fallback methods for Chrome storage (when Go server is unavailable)
    async getCachedVerificationFallback(email) {
        try {
            const cacheKey = `email_verification_${email.toLowerCase()}`;
            const result = await chrome.storage.local.get(cacheKey);
            
            if (result[cacheKey]) {
                const cachedData = result[cacheKey];
                const now = Date.now();
                const cacheAge = now - cachedData.timestamp;
                
                console.log(`📦 Chrome storage cache hit for ${email} (cached ${Math.round(cacheAge / 1000 / 60)} minutes ago)`);
                return cachedData.verification;
            }
            
            console.log(`📦 Chrome storage cache miss for ${email}`);
            return null;
        } catch (error) {
            console.error('❌ Error reading from Chrome storage:', error);
            return null;
        }
    }

    async setCachedVerificationFallback(email, verificationResult) {
        try {
            const cacheKey = `email_verification_${email.toLowerCase()}`;
            const cacheData = {
                email: email.toLowerCase(),
                verification: verificationResult,
                timestamp: Date.now()
            };
            
            await chrome.storage.local.set({ [cacheKey]: cacheData });
            console.log(`📦 Cached verification result for ${email} in Chrome storage`);
        } catch (error) {
            console.error('❌ Error saving to Chrome storage:', error);
        }
    }

    async removeCachedVerificationFallback(email) {
        try {
            const cacheKey = `email_verification_${email.toLowerCase()}`;
            await chrome.storage.local.remove(cacheKey);
            console.log(`📦 Removed cached verification for ${email} from Chrome storage`);
        } catch (error) {
            console.error('❌ Error removing from Chrome storage:', error);
        }
    }

    async getCacheStatsFallback() {
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
            console.error('❌ Error getting Chrome storage stats:', error);
            return { totalEntries: 0, newestEntry: 0, oldestEntry: 0 };
        }
    }

    async initializeCacheFallback() {
        try {
            const stats = await this.getCacheStatsFallback();
            console.log(`📦 Email Verification Cache Stats (Chrome Storage):`, {
                'Total cached emails': stats.totalEntries,
                'Newest entry': stats.newestEntry ? new Date(stats.newestEntry).toLocaleString() : 'None',
                'Oldest entry': stats.oldestEntry < Date.now() ? new Date(stats.oldestEntry).toLocaleString() : 'None'
            });
        } catch (error) {
            console.error('❌ Error initializing Chrome storage cache:', error);
        }
    }

    async clearAllCacheFallback() {
        try {
            const allStorage = await chrome.storage.local.get();
            const verificationKeys = Object.keys(allStorage).filter(key => 
                key.startsWith('email_verification_')
            );
            
            if (verificationKeys.length > 0) {
                await chrome.storage.local.remove(verificationKeys);
                console.log(`📦 Cleared ${verificationKeys.length} cached verification entries from Chrome storage`);
                return verificationKeys.length;
            } else {
                console.log('📦 No cache entries to clear in Chrome storage');
                return 0;
            }
        } catch (error) {
            console.error('❌ Error clearing Chrome storage cache:', error);
            return 0;
        }
    }

    // Form data utility methods
    // Leads Counter Methods
    async initializeLeadsCounter() {
        console.log('🔄 Initializing leads counter...');
        await this.fetchLeadsCount();
    }

    async refreshLeadsCount() {
        if (this.isRefreshingLeads) return;
        
        this.isRefreshingLeads = true;
        this.elements.refreshLeadsBtn.classList.add('loading');
        this.updateCounterStatus('Refreshing...');
        
        try {
            await this.fetchLeadsCount();
        } finally {
            this.isRefreshingLeads = false;
            this.elements.refreshLeadsBtn.classList.remove('loading');
        }
    }

    async fetchLeadsCount() {
        try {
            console.log('📊 Fetching leads count from server...');
            
            const response = await fetch(`${this.cacheServerUrl}/leads/count`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                this.updateLeadsDisplay(data.validUnexported, data.totalLeads,data.leadCountPerList);
                console.log(`✅ Found ${data.validUnexported} valid unexported leads out of ${data.totalLeads} total`);
            } else {
                throw new Error(data.error || 'Failed to fetch leads count');
            }
        } catch (error) {
            console.error('❌ Error fetching leads count:', error);
            this.updateLeadsDisplay('--', 0,null,true);
            this.updateCounterStatus(`Error: ${error.message}`, 'error');
        }
    }

    updateLeadsDisplay(validUnexported, totalLeads, leadCountPerList, isError = false) {
        this.elements.validUnexportedCount.textContent = validUnexported;
        
        if (isError) {
            this.updateCounterStatus('Connection failed', 'error');
            this.hideListBreakdown();
        } else if (validUnexported === 0) {
            this.updateCounterStatus('All leads exported', 'success');
            this.updateListBreakdown(leadCountPerList);
        } else {
            const statusText = totalLeads > 0 ? 
                `Updated • ${totalLeads} total leads` : 
                'No leads found';
            this.updateCounterStatus(statusText, 'success');
            this.updateListBreakdown(leadCountPerList);
        }
    }

    updateListBreakdown(leadCountPerList) {
        if (!leadCountPerList || Object.keys(leadCountPerList).length === 0) {
            this.hideListBreakdown();
            return;
        }

        // Clear existing content
        this.elements.breakdownContent.innerHTML = '';

        // Sort lists by count (descending)
        const sortedLists = Object.entries(leadCountPerList)
            .sort(([,a], [,b]) => b - a)
            .filter(([listName, count]) => listName && count > 0);

        if (sortedLists.length === 0) {
            this.hideListBreakdown();
            return;
        }

        // Create list items
        sortedLists.forEach(([listName, count]) => {
            const listItem = document.createElement('div');
            listItem.className = 'breakdown-item';
            
            listItem.innerHTML = `
                <div class="breakdown-item-content">
                    <span class="list-name" title="${listName}">${listName}</span>
                    <span class="list-count">${count}</span>
                </div>
                <div class="breakdown-item-bar">
                    <div class="breakdown-item-fill" style="width: ${this.calculateBarWidth(count, sortedLists)}%"></div>
                </div>
            `;
            
            this.elements.breakdownContent.appendChild(listItem);
        });

        // Show the breakdown section
        this.elements.listBreakdown.style.display = 'block';
    }

    calculateBarWidth(count, allLists) {
        const maxCount = Math.max(...allLists.map(([, c]) => c));
        return maxCount > 0 ? (count / maxCount) * 100 : 0;
    }

    hideListBreakdown() {
        this.elements.listBreakdown.style.display = 'none';
    }

    updateCounterStatus(message, type = '') {
        this.elements.counterStatus.textContent = message;
        this.elements.counterStatus.className = `counter-status ${type}`;
    }

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

    async saveCustomEmail() {
        const customEmail = this.elements.customEmailInput.value.trim();
        const name = this.elements.nameInput.value.trim();
        const companyName = this.elements.companyInput.value.trim();

        // Basic validation
        if (!customEmail) {
            this.showError('Please enter a custom email address');
            return;
        }

        if (!name) {
            this.showError('Please enter a name first');
            return;
        }

        if (!companyName) {
            this.showError('Please enter a company name first');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customEmail)) {
            this.showError('Please enter a valid email address');
            return;
        }

        // Set loading state for the save button
        this.elements.saveEmailButton.disabled = true;
        const originalButtonText = this.elements.saveEmailButton.innerHTML;
        this.elements.saveEmailButton.innerHTML = `
            <svg class="button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
            </svg>
            Saving...
        `;

        try {
            // Parse the name into first and last names
            const nameParts = name.split(/\s+/).filter(part => part.length > 0);
            const firstName = nameParts[0] ? nameParts[0].toLowerCase() : '';
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase() : '';

            // Extract domain from email
            const domain = customEmail.split('@')[1];

            // Create lead data object to match the format used in verifyEmail
            const dataToBeStoredInCache = {
                firstName: firstName,
                lastName: lastName,
                companyName: companyName,
                domain: domain,
                email: customEmail,
                emailStatus: "valid",
            };

            console.log('Saving custom email lead data:', dataToBeStoredInCache);

            // Use the existing setCachedVerification method to store the data
            await this.setCachedVerification(customEmail, dataToBeStoredInCache);

            // Show success feedback
            this.elements.saveEmailButton.innerHTML = `
                <svg class="button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Saved!
            `;
            this.elements.saveEmailButton.style.background = 'linear-gradient(135deg, hsl(142, 76%, 45%), hsl(142, 76%, 54%))';

            // Hide any previous errors
            this.hideError();

            // Clear the custom email input
            this.elements.customEmailInput.value = '';

            // Refresh leads count to show the new entry
            setTimeout(() => {
                this.refreshLeadsCount();
            }, 500);

            // Reset button after 2 seconds
            setTimeout(() => {
                this.elements.saveEmailButton.innerHTML = originalButtonText;
                this.elements.saveEmailButton.style.background = '';
                this.elements.saveEmailButton.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('Error saving custom email:', error);
            this.showError(`Failed to save email: ${error.message}`);
            
            // Reset button
            this.elements.saveEmailButton.innerHTML = originalButtonText;
            this.elements.saveEmailButton.disabled = false;
        }
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
        removeCachedEmail: (email) => leadGeneratorSidebar.removeCachedVerification(email),
        refreshLeadsCount: () => leadGeneratorSidebar.refreshLeadsCount(),
        refreshLeadsCount: () => leadGeneratorSidebar.refreshLeadsCount()
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
        removeCachedEmail: (email) => leadGeneratorSidebar.removeCachedVerification(email),
        refreshLeadsCount: () => leadGeneratorSidebar.refreshLeadsCount()
    };
}

