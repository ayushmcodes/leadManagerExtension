# LinkedIn Lead Generator Extension 🎯

A Brave browser extension that extracts LinkedIn profile information through a convenient sidebar interface.

## Features

- **Sidebar Interface**: Clean, modern sidebar (not a popup) for better user experience
- **Profile Detection**: Automatically detects when you're on a LinkedIn profile page
- **Data Extraction**: Extracts key profile information including:
  - Full name
  - Professional headline
  - Location
  - Current company
  - Profile picture
- **Visual Indicators**: Badge and status indicators show when profiles are detected
- **Error Handling**: Graceful error handling with user-friendly messages

## Installation

1. **Download the Extension**
   - Clone or download this repository to your local machine

2. **Open Brave Browser**
   - Navigate to `brave://extensions/`

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

5. **Pin the Extension (Optional)**
   - Click the extensions puzzle icon in the toolbar
   - Pin the LinkedIn Lead Generator for easy access

## How to Use

1. **Navigate to LinkedIn**
   - Go to any LinkedIn profile page (e.g., `linkedin.com/in/username`)
   - You'll see a blue dot badge on the extension icon when a profile is detected

2. **Open the Sidebar**
   - Click the extension icon in your browser toolbar
   - The sidebar will open on the right side of your browser

3. **Extract Profile Data**
   - Click the "🔍 Scan Profile" button in the sidebar
   - The extension will extract and display the profile information

4. **View Results**
   - Profile information will be displayed in a clean card format
   - Includes name, headline, location, company, and profile picture

## File Structure

```
leadGeneratorExtension/
├── manifest.json          # Extension configuration
├── sidebar.html           # Sidebar interface
├── sidebar.css            # Sidebar styling
├── sidebar.js             # Sidebar functionality
├── content.js             # LinkedIn page interaction
├── background.js          # Extension background process
└── README.md              # This file
```

## Technical Details

- **Manifest Version**: 3 (latest standard)
- **Permissions**: `sidePanel`, `activeTab`, `scripting`
- **Host Permissions**: `*://www.linkedin.com/*`
- **Architecture**: Content script + Background script + Sidebar

## Troubleshooting

### Extension Not Loading
- Make sure all files are in the same directory
- Check that Developer mode is enabled in `brave://extensions/`
- Try reloading the extension

### Profile Data Not Extracting
- Ensure you're on a valid LinkedIn profile page (`linkedin.com/in/...`)
- Wait for the page to fully load before clicking "Scan Profile"
- Some profile elements might be restricted based on your LinkedIn connection level

### Sidebar Not Opening
- Click directly on the extension icon (not right-click)
- Check that the extension has proper permissions
- Try refreshing the LinkedIn page

## Privacy & Security

- **Local Processing**: All data extraction happens locally in your browser
- **No Data Storage**: Profile information is not stored or transmitted anywhere
- **LinkedIn Only**: Extension only activates on LinkedIn.com domains
- **Permissions**: Minimal permissions requested for core functionality

## Development

### Making Changes
1. Edit the source files
2. Go to `brave://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

### Adding Features
- Modify `content.js` for additional data extraction
- Update `sidebar.html` and `sidebar.css` for UI changes  
- Extend `sidebar.js` for new functionality

## Version History

- **v1.0**: Initial release with basic profile extraction and sidebar interface

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Ensure you're using a supported Brave browser version

---

**Note**: This extension is for educational and legitimate business purposes only. Always respect LinkedIn's terms of service and user privacy when using this tool.
