# Project Report: FeedForward

**Project Title:** FeedForward — A Food Waste Redistribution Platform  
**Type:** Full-Stack Web Application (MERN Stack)

---

## Executive Summary

The project was carried out with the objective of understanding and addressing the critical gap between food surplus and food scarcity in our communities. Despite the fact that a significant portion of prepared food goes to waste globally, local NGOs and charities often struggle to collect donations efficiently due to logistical challenges, poor coordination, and a lack of transparency that discourages potential donors from contributing.

To address these systemic gaps, FeedForward, a comprehensive full-stack web-based food redistribution platform, was designed and developed. FeedForward creates a unified digital ecosystem connecting food donors, NGO administrators, and volunteer delivery agents. The platform enables donors to quickly register surplus food with live GPS coordinates, track the journey of their donations in real-time, and earn gamified reward points. Administrators access a centralized fleet-management dashboard to verify food posts, monitor active agents on a live city map, and seamlessly dispatch volunteers. Delivery agents utilize integrated map navigation to pick up the food and update the delivery status, ensuring end-to-end accountability.

Project activities included the architectural design of a MERN (MongoDB, Express, React, Node.js) stack application, database schema modeling for complex logistical workflows, integration of Socket.IO for persistent real-time bi-directional communication, implementation of Leaflet maps and OSRM routing for live tracking, and the development of distinct role-based secure interfaces for donors, NGOs, and delivery agents.

**Learning Objectives**
* To understand the socio-technical and logistical challenges affecting food waste and redistribution in local communities.
* To study the impact of fragmented donation processes on transparency, operational efficiency, and donor trust.
* To learn modern full-stack web application development using the MERN stack (MongoDB, Express, React.js, Node.js).
* To develop skills in implementing real-time data synchronization using WebSockets (Socket.IO) and integrating third-party mapping APIs (Leaflet.js).
* To understand role-based access control (RBAC) and secure authentication workflows using JSON Web Tokens (JWT).
* To create user-centered interface designs that incentivize participation through gamification and live-tracking transparency.

**Learning Outcomes**
* Acquired practical knowledge of the logistical challenges in the food donation ecosystem and how technology can bridge these gaps.
* Understood the role of centralized, real-time digital platforms in improving operational transparency and reducing food spoilage.
* Gained hands-on experience in full-stack web development, cloud database management (MongoDB Atlas), and responsive UI implementation using Tailwind CSS.
* Developed problem-solving and systems-thinking skills by mapping out the complete lifecycle of a food donation from creation to delivery.
* Enhanced technical integration skills by combining diverse tools like Nodemailer for alerts, cloud storage (Cloudinary) for images, and real-time mapping for fleet management.
* Understood the social importance of utilizing scalable software engineering to drive sustainable community initiatives and reduce food waste.

The project successfully demonstrated how a well-architected, real-time logistics platform can close the coordination gap between food donors and NGOs, promoting a more transparent, efficient, and sustainable approach to hunger alleviation and food waste reduction.

---

## 1. Abstract

**FeedForward** is a comprehensive software solution designed to bridge the gap between food surplus and food scarcity. Approximately one-third of all food produced globally goes to waste, while millions suffer from hunger. This platform connects individuals or organizations with surplus food (Donors), local Non-Governmental Organizations (NGO Admins), and logistics volunteers (Delivery Agents). 

By providing a unified portal with real-time tracking, seamless logistics, and a gamified reward system, FeedForward ensures that excess food is efficiently redistributed to those in need before it spoils.

---

## 2. Problem Statement

1. **Food Wastage:** Restaurants, event organizers, and households frequently discard excess edible food because they lack an immediate way to donate it.
2. **Logistical Gap:** NGOs often struggle to collect donations efficiently due to poor coordination and lack of transport.
3. **Lack of Transparency:** Donors hesitate to contribute because they do not know whether the food successfully reached the intended beneficiaries.

---

## 3. Proposed Solution

FeedForward solves this by operating a three-node ecosystem:
*   **Donors** upload details of excess food along with their live GPS coordinates and an image.
*   **NGO Admins** review incoming food posts, verify their validity, and assign an available delivery agent to collect it.
*   **Delivery Agents** receive assignments, use live map navigation to pick up the food, and deliver it to the NGO. 

The entire process is transparent, offering a Swiggy/Zomato-style live tracking feature so the donor can see exactly where the agent is, and when the food is successfully delivered.

---

## 4. System Architecture

The project is built on the **MERN** architecture (MongoDB, Express, React, Node.js):
*   **Client (Frontend):** A Single Page Application (SPA) built with React.js. It handles routing, state management, UI rendering, and real-time map updates.
*   **Server (Backend):** A RESTful API built with Node.js and Express.js. It manages business logic, database transactions, image uploads, and email services.
*   **Real-time Communication:** Socket.IO is implemented to create a persistent bi-directional connection between the Delivery Agent (streaming their GPS coordinates) and the Donor/Admin (receiving coordinates).
*   **Database:** MongoDB Atlas (Cloud NoSQL DB).

---

## 5. Technology Stack

| Component | Technology Used |
| :--- | :--- |
| **Frontend** | React.js, Tailwind CSS, Framer Motion (Animations) |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB (Mongoose ODM) |
| **Authentication**| JSON Web Tokens (JWT), bcryptjs (Password Hashing) |
| **Real-time Engine**| Socket.IO |
| **Maps & Routing**| Leaflet.js, OpenStreetMap (CARTO tiles), Project OSRM API |
| **Cloud Storage** | Cloudinary (via Multer for image uploads) |
| **Email Service** | Nodemailer (Gmail SMTP for notifications) |

---

## 6. Database Schema (Entities)

The system relies on three core Mongoose Models:

### 1. User Model
Stores credentials and profile details for all three roles.
*   `name`, `email`, `password`, `phone`, `address`, `profilePhoto`, `bio`
*   `role`: Enum (`donor`, `admin`, `agent`)
*   `points`: Integer (Tracks gamified reward points for donors)
*   `organizationName`: String (Specific to Admin)
*   `vehicleType`, `isAvailable`: Specific to Agents.

### 2. FoodPost Model
Tracks the lifecycle of a food donation from creation to completion.
*   `donorId`, `adminId`, `agentId`, `deliveryId`: Relational Object IDs
*   `foodName`, `quantity`, `type` (veg/non-veg), `expiryTime`, `description`, `photo`
*   `location`: Nested object `(lat, lng, address)`
*   `status`: Enum (`pending`, `accepted`, `agent_assigned`, `picked_up`, `delivered`, `rejected`)
*   `timestamps`: Array of objects to track time at each status step.

### 3. Delivery Model
Manages the logistical mapping between the FoodPost and the Agent.
*   `foodPostId`, `donorId`, `adminId`, `agentId`
*   `adminLocation`: NGO destination `(lat, lng, address)`
*   `status`: Enum (`assigned`, `accepted`, `in_transit`, `picked_up`, `delivered`, `rejected_by_agent`)
*   `agentLocation`: Live updated `(lat, lng)`
*   `statusHistory`: Array logging time of every delivery milestone.

---

## 7. Key Modules & User Workflows

### Module 1: Authentication & Authorization
*   Role-based access control (RBAC). A user logs in and is dynamically routed to the Donor, Admin, or Agent dashboard depending on their token payload.

### Module 2: The Donor Interface
*   **Donation Posting:** Form validation for food type, expiry, and uploading an image directly to Cloudinary.
*   **Live Order Tracking:** Similar to e-commerce, the donor views a multi-step timeline.
*   **Live Map:** If an agent is in transit, the donor sees the agent's exact location moving on an embedded Leaflet map.
*   **Gamification:** Donors earn points for successful deliveries, unlocking badges to incentivize continuous charity.

### Module 3: The NGO Admin Interface
*   **Food Verification:** Admins accept or reject incoming posts based on NGO capacity.
*   **Fleet Management:** Admins view a live dashboard plotting the locations of all active agents on a city map. They assign specific agents to accepted food posts.
*   **User Management:** Ability to view all registered donors and agents, and manually assign reward points.

### Module 4: The Delivery Agent Interface
*   **Task Management:** Accept or reject assigned deliveries.
*   **Navigation API:** The app utilizes the OSRM routing API to draw a path from the agent's current location to the donor's address, calculating distance and Estimated Time of Arrival (ETA).
*   **Status Updates:** Agents update the system when food is picked up and successfully delivered, triggering state changes across the entire database.

---

## 8. Future Scope

*   **AI Food Quality Verification:** Implement an AI model to analyze the uploaded food images to pre-screen for spoilage.
*   **Push Notifications:** Integrate Firebase Cloud Messaging (FCM) or Web Push to notify agents of new assignments instantly without needing to keep the tab active.
*   **Data Analytics Dashboard:** Provide NGOs with heatmaps of areas generating the most food waste to optimize operational presence.

---

## 9. Conclusion

FeedForward effectively leverages modern web technologies (MERN stack, WebSockets, mapping APIs) to solve a critical real-world problem. By providing transparency and a gamified experience, the platform incentivizes the public to participate in food waste reduction, thereby creating a sustainable channel for feeding vulnerable communities.
