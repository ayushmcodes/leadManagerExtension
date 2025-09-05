// LinkedIn Lead Generator - Background Script
console.log('LinkedIn Lead Generator background script loaded');

class LeadGeneratorBackground {
    constructor() {
        this.setupEventListeners();
        this.initializeSidePanel();
    }

    setupEventListeners() {
        // Handle extension icon click
        chrome.action.onClicked.addListener((tab) => {
            this.toggleSidePanel(tab);
        });

        // Handle messages from content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'linkedinProfileDetected') {
                console.log('LinkedIn profile detected:', request.url);
                this.updateBadge(sender.tab.id, true);
            }
        });

        // Handle tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                const isLinkedInProfile = tab.url.includes('linkedin.com/in/');
                this.updateBadge(tabId, isLinkedInProfile);
            }
        });

        // Handle tab activation
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            try {
                const tab = await chrome.tabs.get(activeInfo.tabId);
                const isLinkedInProfile = tab.url && tab.url.includes('linkedin.com/in/');
                this.updateBadge(activeInfo.tabId, isLinkedInProfile);
            } catch (error) {
                console.error('Error handling tab activation:', error);
            }
        });

        // Handle extension installation
        chrome.runtime.onInstalled.addListener(() => {
            console.log('LinkedIn Lead Generator extension installed');
        });
    }

    async initializeSidePanel() {
        try {
            // Enable side panel for all sites initially
            await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        } catch (error) {
            console.error('Error initializing side panel:', error);
        }
    }

    async toggleSidePanel(tab) {
        try {
            // Open side panel
            await chrome.sidePanel.open({ tabId: tab.id });
        } catch (error) {
            console.error('Error toggling side panel:', error);
        }
    }

    updateBadge(tabId, isLinkedInProfile) {
        try {
            if (isLinkedInProfile) {
                chrome.action.setBadgeText({
                    tabId: tabId,
                    text: '●'
                });
                chrome.action.setBadgeBackgroundColor({
                    tabId: tabId,
                    color: '#0077b5' // LinkedIn blue
                });
                chrome.action.setTitle({
                    tabId: tabId,
                    title: 'LinkedIn Lead Generator - Profile detected! Click to open sidebar.'
                });
            } else {
                chrome.action.setBadgeText({
                    tabId: tabId,
                    text: ''
                });
                chrome.action.setTitle({
                    tabId: tabId,
                    title: 'LinkedIn Lead Generator - Navigate to a LinkedIn profile to extract information.'
                });
            }
        } catch (error) {
            console.error('Error updating badge:', error);
        }
    }
}

// Initialize the background script
new LeadGeneratorBackground();
