# Sabores del Trigo - Frontend (Vue)

Web management interface for the bakery and pizzeria system built with Vue 3 + Vuetify.

## Features

- 🎨 **Modern UI**: Built with Vuetify Material Design
- 📱 **Responsive**: Fully responsive design for all devices
- 🔐 **Authentication**: Secure login with JWT tokens
- 📊 **Dashboard**: Real-time statistics and analytics
- 🍞 **Complete Management**: Products, orders, inventory, reports
- 👥 **User Management**: Role-based access control
- ⚡ **Fast**: Built with Vite for optimal performance

## Technologies

- **Framework**: Vue 3 + TypeScript
- **UI Library**: Vuetify 3 (Material Design)
- **State Management**: Pinia
- **Routing**: Vue Router 4
- **Build Tool**: Vite
- **HTTP Client**: Axios
- **Icons**: Material Design Icons

## Requirements

- Node.js 20 or higher
- npm or yarn
- Backend API running (Laravel)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sabores-del-trigo-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Environment Variables

Configure in `.env`:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8001/api
VITE_APP_NAME="Sabores del Trigo"

# App Configuration  
VITE_APP_VERSION=1.0.0
VITE_APP_DESCRIPTION="Sistema de Gestión para Panadería y Pizzería"

# Development
VITE_DEV_MODE=true
```

**Important**: Make sure the backend API is running on the URL specified in `VITE_API_BASE_URL`

## Default Users

To login, you need the backend running with seeded users:

- **Admin**: `admin@saboresdeltrigo.com` / `admin123`
- **Employee**: `empleado@saboresdeltrigo.com` / `empleado123`

## Getting Started

### Quick Start

1. **Start the Backend** (required):
```bash
# In the backend directory
composer install
php artisan migrate --seed
php artisan serve --port=8001
```

2. **Start the Frontend**:
```bash
# In the frontend directory
npm install
npm run dev
```

3. **Access the Application**:
   - Open `http://localhost:5173` in your browser
   - Login with admin credentials: `admin@saboresdeltrigo.com` / `admin123`

## Project Structure

```
src/
├── pages/              # Main application pages
│   ├── Dashboard.vue       # Main dashboard with statistics
│   ├── Login.vue          # Authentication page
│   ├── Products.vue       # Product catalog management
│   ├── Orders.vue         # Order management
│   ├── Inventory.vue      # Inventory control
│   ├── Reports.vue        # Reports and analytics
│   └── Users.vue          # User management (admin only)
├── router/             # Vue Router configuration
│   └── index.ts           # Route definitions
├── components/         # Reusable Vue components
├── services/          # API services (to be implemented)
├── stores/            # Pinia stores (to be implemented)
├── types/             # TypeScript type definitions
└── main.ts            # Application entry point
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - TypeScript type checking

## Features Overview

### 🏠 Dashboard
- Real-time sales statistics
- Recent orders overview
- Low stock alerts
- Top-selling products
- Quick action buttons

### 🍞 Product Management
- Complete product catalog
- Category organization
- Price management
- Availability toggles
- Image uploads
- Preparation times

### 📋 Order Management
- Order creation and tracking
- Status updates (pending, preparing, ready, delivered)
- Order types (dine-in, takeaway, delivery)
- Customer information
- Order history

### 📦 Inventory Control
- Stock level monitoring
- Low stock alerts
- Raw materials tracking
- Supplier management
- Purchase history

### 📊 Reports & Analytics
- Sales reports (daily, weekly, monthly)
- Product performance
- Revenue analytics
- Export capabilities
- Electronic invoicing

### 👥 User Management
- User creation and editing
- Role assignment (admin/employee)
- Permission management
- Activity logging

## Development

### Adding New Features

1. **Create new pages** in `src/pages/`
2. **Add routes** in `src/router/index.ts`
3. **Update navigation** in `App.vue`
4. **Create API services** in `src/services/`
5. **Add Pinia stores** for state management

### Theme Customization

The Vuetify theme is configured in `src/main.ts`:

```typescript
const vuetify = createVuetify({
  theme: {
    themes: {
      light: {
        colors: {
          primary: '#f26916',    // Sabores del Trigo orange
          secondary: '#6b7280',  // Gray
          accent: '#e3530c',     // Darker orange
          // ... other colors
        },
      },
    },
  },
})
```

## Production Build

1. Build the application:
```bash
npm run build
```

2. Preview locally:
```bash
npm run preview
```

3. Deploy the `dist/` folder to your web server

### Environment Variables for Production

Update `.env` for production:

```env
VITE_API_BASE_URL=https://your-api-domain.com/api
VITE_DEV_MODE=false
```

## Mobile App Integration

This web frontend is designed to work alongside a future mobile app for order taking:

- **Web Frontend (Vue)**: Complete business management
- **Mobile App (React Native)**: Simple order taking interface

Both will use the same Laravel API backend.

## Troubleshooting

### Common Issues

1. **Vuetify Components Not Loading**
   - Verify Vuetify is properly imported in `main.ts`
   - Check that MDI icons are loaded: `@mdi/font/css/materialdesignicons.css`

2. **API Connection Failed**
   - Ensure backend is running on the correct port
   - Check `VITE_API_BASE_URL` in `.env`
   - Verify CORS configuration in Laravel backend

3. **Login Not Working**
   - Confirm backend seeders were run
   - Check browser network tab for API errors
   - Verify user credentials

4. **Build Errors**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version (requires 20+)
   - Run type checking: `npm run type-check`

### Performance Tips

- Components are lazy-loaded using `() => import()`
- Vuetify is configured with only needed components
- Images should be optimized before upload
- Use Vuetify's built-in responsive breakpoints

## Contributing

When adding new features:

1. Follow Vue 3 Composition API patterns
2. Use TypeScript for type safety
3. Follow Vuetify design guidelines
4. Add proper error handling
5. Update this README if needed

## Support

For issues related to:
- **UI Components**: Check [Vuetify Documentation](https://vuetifyjs.com/)
- **Vue Framework**: Check [Vue 3 Documentation](https://vuejs.org/)
- **Build Tool**: Check [Vite Documentation](https://vitejs.dev/)
- **API Integration**: Ensure backend is properly configured