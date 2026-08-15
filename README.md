# premCall - Give Your Number a Life, Truly untraceable 

<p align="center">
  <img src="https://raw.githubusercontent.com/suryasticsai/premCall/main/premCall-logo.png" alt="premCall Logo" width="200"/>
</p>

<h3 align="center">
  <b>A Lightweight, P2P Communication Tool</b><br/>
  <sub>Call & Text using your Phone Number. Zero Recharge? No Problem.</sub>
</h3>

<p align="center">
  <img src="https://img.shields.io/badge/WebRTC-P2P-brightgreen?style=for-the-badge&logo=webrtc" />
  <img src="https://img.shields.io/badge/Progressive_Web_App-Installable-blue?style=for-the-badge&logo=pwa" />
  <img src="https://img.shields.io/badge/Open_Source-MIT-green?style=for-the-badge&logo=github" />
  <img src="https://img.shields.io/badge/Lightweight-~200KB-important?style=for-the-badge" />
</p>

<br/>

## 🚀 The Problem

We've all been there. 📴 Your prepaid recharge expires, or your SIM validity runs out, and you urgently need to make a call. WiFi is available, but WhatsApp, Telegram, and Signal require an active number for verification. You're stuck.

## 💡 The Solution

**premCall** bypasses the traditional cellular requirement. As long as you have an **internet connection (WiFi/Data)**, you can register your number once and instantly connect with friends on the same platform. It gives your inactive number a digital life!

> 💬 *“When your balance hits zero, premCall keeps the conversation going.”*

<br/>

## ✨ Key Features

<table>
  <tr>
    <td align="center"><b>💰 Zero Recharge</b></td>
    <td>Use WiFi or mobile data to call and text. No need for active talktime or SMS packs.</td>
  </tr>
  <tr>
    <td align="center"><b>🌐 Web-Based (PWA)</b></td>
    <td>No app store downloads. Open it in your browser and install it as a Progressive Web App (PWA) instantly.</td>
  </tr>
  <tr>
    <td align="center"><b>🔐 Phone Number Identity</b></td>
    <td>Uses your real phone number. No complex usernames or IDs—just your number and OTP verification.</td>
  </tr>
  <tr>
    <td align="center"><b>🔒 End-to-End Encrypted (P2P)</b></td>
    <td>Messages and calls go directly between peers. No central server stores your conversations or call logs.</td>
  </tr>
  <tr>
    <td align="center"><b>⚡ Lightweight & Fast</b></td>
    <td>Built with vanilla JS and optimized WebRTC libraries. Loads in milliseconds and consumes minimal data.</td>
  </tr>
  <tr>
    <td align="center"><b>📞 High-Quality Voice Calls</b></td>
    <td>Crystal clear HD audio calls powered by WebRTC. It feels just like a regular phone call, but over the internet.</td>
  </tr>
  <tr>
    <td align="center"><b>📱 SMS-Style Chat</b></td>
    <td>Simple, clean, and familiar interface. It looks and feels like your native SMS app, making it incredibly easy to use.</td>
  </tr>
</table>

<br/>

## 🔮 How It Works

It’s as easy as 1-2-3.

<p align="center">
  <img src="https://via.placeholder.com/800x300/0b0e14/4f8cf7?text=1.+Register+Number+%7C+2.+Verify+OTP+%7C+3.+Call+%26+Text+Friends" alt="How it works steps" />
</p>

1.  **Register:** Enter your phone number in the app.
2.  **Verify:** Enter the OTP received on your number (or via fallback methods).
3.  **Connect:** Search for a contact and start texting or calling!

<br/>

## 🧱 Architecture Overview

premCall uses a hybrid architecture to ensure maximum privacy and performance.

```mermaid
graph TD
    subgraph P2P["Peer‑to‑Peer Connection"]
        A[Your Device<br><small>P2P Client</small>]
        B[Friend's Device<br><small>P2P Client</small>]
        A -- "🔒 WebRTC (P2P)" --> B
    end

    subgraph Hub["Signaling & Identity Hub"]
        C[Firebase Auth / Firestore]
    end

    A -.->|Initial handshake & number mapping| C
    B -.->|Initial handshake & number mapping| C

    style A fill:#1b2540,stroke:#4f8cf7,color:#eef2fb
    style B fill:#1b2540,stroke:#4f8cf7,color:#eef2fb
    style C fill:#0e1424,stroke:#525d78,color:#8891ab
```

> The server is **only** used for the initial connection handshake. Once connected, all data (messages & audio) flows directly between peers.
 


> The server is **only** used for the initial connection handshake. Once connected, all data (messages & audio) flows directly between peers.

<br/>

## 📸 Screenshots (Preview)

<!-- Replace the placeholders below with your actual screenshots -->
<p align="center">
  <img src="https://via.placeholder.com/200x400/1b2540/eef2fb?text=Join+Screen" alt="Join Screen" width="200" />
  <img src="https://via.placeholder.com/200x400/1b2540/eef2fb?text=Chat+Screen" alt="Chat Screen" width="200" />
  <img src="https://via.placeholder.com/200x400/1b2540/eef2fb?text=Calling" alt="Calling Screen" width="200" />
</p>

<br/>

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Real-time Communication:** WebRTC, Trystero (P2P Signaling Layer)
- **Authentication/Identity:** Firebase Auth (Anonymous -> Phone Claim via OTP)
- **Database:** Firebase Firestore (Only for user mapping & simple metadata)
- **Hosting:** GitHub Pages / Firebase Hosting

<br/>

## 🚀 Getting Started (Development)

To get a local copy up and running, follow these simple steps.

1.  **Clone the repository**
    ```sh
    git clone https://github.com/suryasticsai/premCall.git
    cd premCall
    ```

2.  **Set up Firebase**
    - Go to Firebase Console and create a new project.
    - Enable Anonymous Authentication.
    - Enable Firestore Database.
    - Copy your Firebase config to `script.js`.

3.  **Run the App**
    Just open the `index.html` file in your browser.
    ```sh
    open index.html
    ```
    *Or use a local server like Live Server in VSCode.*

<br/>

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

<br/>

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

<br/>

## 🙏 Acknowledgments

- [WebRTC](https://webrtc.org/) for making peer-to-peer communication possible.
- [Trystero](https://github.com/dmotz/trystero) for simplifying the P2P signaling process.
- [Firebase](https://firebase.google.com/) for providing a seamless authentication layer.
- All the early testers and contributors!

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/suryasticsai">Suryasticsai</a>
</p>