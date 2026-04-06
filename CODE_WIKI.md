# AutoPalette Project & Code Wiki

## Overview
**AutoPalette** is a high-end detailing and automotive custom aesthetics web application. The platform is designed to be highly interactive, data-rich, and visually striking, aiming for a "Terry Noir × Need for Speed Underground" design standard as part of the broader Ooru Logix ecosystem.

## Tech Stack
- **Structure**: Vanilla HTML5 (`index.html`)
- **Logic**: Vanilla JavaScript (`main.js`)
- **Styling**: Vanilla CSS (`style.css`), fully custom without heavy frameworks to maximize control over visual effects and animations.
- **Hosting / Ecosystem**: Part of the Ooru Logix company orchestration.

## Architecture

* `index.html`: The core single-page layout. Contains sections for the landing hero (loading sequences), aesthetic showcases, a tactical price estimator, a FAQ section, and a WhatsApp-based enquiry pipeline.
* `style.css`: Uses heavy CSS custom properties (variables) for theme management. Integrates advanced visual treatments like dark-mode, glassmorphism, RGB pinstriping, and gold accents.
* `main.js`: Handles UI logic, DOM manipulation, custom cursor handling, mouse-parallax effects, loading animations (Engine Start sequence), and the cost-estimator logic.
* `public/`: Assets directory including fonts, vector graphics, and standard branding files (XXXL logos, partner badges).

## Recent Changelog & Evolution

### 1. Visual & Aesthetic Overhaul
The website recently underwent a significant "Tactical Operation Center" / "Cyber-Industrial" evolution:
- **Cyberpunk Mission Briefing & Terry Noir Aesthetics**: Applied deep darks and high-contrast tactical styling across all components.
- **RGB Pinstripes & Accents**: Implemented full RGB pinstripe integration across all homepage sections, bringing a premium neon vibe reminiscent of midnight car tuning scenes.
- **XXXL Prominent Core Brand Identity**: Amplified the logo size and prominence globally—spanning the navigational navbar, footer, and mobile responsive views.
- **Ooru Logix Branding**: Incorporated "Powered by Ooru Logix" branding as an ecosystem signature.

### 2. Loading Experience
- **Interactive Engine Start Sequence**: Initially integrated a user-prompted animated "Engine Start" overlay, which was later enhanced to automatically trigger upon website loading. This sequence uses dynamic animations (a 3-second loader sequence) alongside floating car brand vector elements to immerse the user immediately. 

### 3. Core Functional & UI Replacements
- **Price Estimator**: Completely removed a redundant/illogical before-and-after transformation slider. Replaced it with a functional, tactical **Price Estimator** that creates a robust data-centric experience for prospective customers to calculate detailing costs immediately.
- **Interactive Custom Cursor**: Implemented to track user movements and shift states over clickable elements.
- **Mouse Parallax Backgrounds**: Integrated dynamic vector backgrounds that react to cursor coordinates, giving the application a deeply reactive, "alive" feeling.
- **Brands Ticker**: Stabilized and cleaned up dead code surrounding the infinite-scroll car brands vector strip.

### 4. Communication & Connectivity
- **WhatsApp Multistep Pipeline**: Standardized lead generation to filter directly into a streamlined WhatsApp enquiry system, capturing core customer intent directly via secure messaging.

---

## Developer Operations (DevOps & Branching)
Code is strictly version-controlled on a master branch (`origin/master`).
When making visual or interactive changes, attention must be paid to ensuring that custom CSS variables and UI breakpoints remain consistent, as animations (like the Engine Start or Price Estimator) heavily depend on synchronized JS timing and CSS transitions.

*Document generated to overview the massive UI/UX overhaul focusing on high interactivity, cyber-aesthetic design, and systemization.*
