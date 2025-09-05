// LinkedIn Lead Generator - Content Script
console.log('LinkedIn Lead Generator content script loaded');

class LinkedInProfileExtractor {
    constructor() {
        this.profileData = {};
        this.setupMessageListener();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'extractProfile') {
                this.extractProfileData()
                    .then(data => {
                        sendResponse({ success: true, data: data });
                    })
                    .catch(error => {
                        console.error('Profile extraction error:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true; // Keep message channel open for async response
            }
        });
    }

    async extractProfileData() {
        // Wait for page to be fully loaded
        await this.waitForElement('h1');
        
        const profileData = {
            name: this.extractName(),
            profileUrl: window.location.href
        };

        console.log('Extracted profile data:', profileData);
        return profileData;
    }

    extractName() {
        // Try multiple selectors for the name
        const nameSelectors = [
            'h1.text-heading-xlarge',
            'h1.inline.t-24.v-align-middle.break-words',
            '.pv-text-details__left-panel h1',
            '.ph5.pb5 h1',
            'main section:first-child h1'
        ];

        for (const selector of nameSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim();
            }
        }

        // Fallback: try to get from page title
        const title = document.title;
        if (title.includes(' | LinkedIn')) {
            return title.split(' | LinkedIn')[0].trim();
        }

        return 'Name not found';
    }


    waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                return;
            }

            const observer = new MutationObserver((mutations) => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }
}

// Initialize the profile extractor
new LinkedInProfileExtractor();

// Also check if we're on a LinkedIn profile page and notify the sidebar
const isLinkedInProfile = window.location.href.includes('linkedin.com/in/');
if (isLinkedInProfile) {
    // Send a message to update the sidebar status
    chrome.runtime.sendMessage({
        action: 'linkedinProfileDetected',
        url: window.location.href
    });
}
