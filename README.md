# 💰 FinanceFlow: Real-Time Wealth Management Dashboard

A high-performance, full-stack financial management application that enables users to securely connect bank accounts, track live transactions, and visualize spending habits through interactive data analytics.

---

## 🚀 Core Features

* **Bank Integration:** Secure connection to over 11,000 financial institutions via the **Plaid API**.
* **Transaction Management:** Automated synchronization and categorization of personal expenses.
* **Data Visualization:** Interactive financial health dashboards utilizing **Recharts** for trend analysis.
* **Secure Authentication:** Enterprise-grade security and multi-factor authentication powered by **Clerk**.
* **Optimistic UI:** Seamless user experience with immediate UI updates using **TanStack Query**.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| **State Management** | TanStack Query (React Query) |
| **UI Components** | Shadcn/UI, Lucide React |
| **Backend** | Next.js Server Actions, Node.js |
| **Database** | PostgreSQL, Prisma ORM |
| **External APIs** | Plaid API, Stripe (Planned) |

---

## 🏗️ Technical Architecture & Challenges

### **Secure Token Exchange**
Implemented a multi-stage OAuth flow to handle Plaid's `public_token` exchange for `access_tokens`. To ensure security, sensitive tokens are encrypted at rest and never exposed to the client-side environment.

### **Server-Side Data Aggregation**
Leveraged Next.js Server Components to fetch and pre-process transaction data. This reduces the client-side JavaScript bundle size and ensures the dashboard is interactive as soon as the page loads.

### **Relational Data Modeling**
Designed a scalable PostgreSQL schema to handle one-to-many relationships between Users, Bank Accounts, and Transactions, ensuring data integrity even with thousands of entries.

---

## 🛠️ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/](https://github.com/)[your-username]/finance-dashboard.git
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory:
    ```env
    DATABASE_URL="your-postgresql-connection-string"
    PLAID_CLIENT_ID="your-plaid-client-id"
    PLAID_SECRET="your-plaid-secret"
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-key"
    CLERK_SECRET_KEY="your-clerk-secret"
    ```

4.  **Initialize the database:**
    ```bash
    npx prisma generate
    npx prisma db push
    ```

5.  **Run the development server:**
    ```bash
    npm run dev
    ```

---

## 📈 Future Roadmap
* **AI Budgeting:** Integrating an LLM to provide automated spending insights and anomalies.
* **OCR Receipt Parsing:** Ability to upload physical receipts and automatically match them to transactions.
* **Multi-Currency Support:** Global financial tracking for international accounts.