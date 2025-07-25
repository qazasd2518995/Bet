# Racing10 Lottery Website

A modern, responsive lottery website built with Next.js that displays real-time Racing10 lottery results and draw history. The website synchronizes with an existing PostgreSQL database containing game state and draw records.

## Features

- 🎯 **Real-time Updates**: Live countdown timer and automatic refresh of game state
- 📊 **Draw History**: Browse historical lottery results by date
- 📱 **Responsive Design**: Optimized for desktop and mobile devices
- 🎨 **Modern UI**: Clean, professional interface with Tailwind CSS
- ⚡ **Fast Performance**: Built with Next.js for optimal loading speeds
- 🔒 **Database Integration**: Connects to existing PostgreSQL database

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **Deployment**: Render

## Live Demo

The website displays:
- Current game state with countdown timer
- Latest winning numbers with animated display
- Historical draw results with date filtering
- Professional lottery website design

## API Endpoints

- `GET /api/game-state` - Current game state and countdown
- `GET /api/latest-draw` - Most recent draw result
- `GET /api/draw-history` - Historical results (with optional date filter)

## Project Structure

```
lottery-website/
├── app/
│   ├── api/           # API routes
│   ├── globals.css    # Global styles
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Main lottery page
├── components/
│   └── countdown-timer.tsx  # Countdown component
├── lib/
│   └── database.ts    # Database connection and queries
├── package.json
├── tailwind.config.js
├── next.config.js
└── render.yaml        # Render deployment config
```

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- Access to the existing PostgreSQL database

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lottery-website
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file with:
```env
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=bet_game
DB_USER=your-database-user
DB_PASSWORD=your-database-password
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

The website expects the following PostgreSQL tables:

### `game_state`
- `current_period` (BIGINT) - Current lottery period
- `countdown_seconds` (INTEGER) - Seconds until next draw
- `last_result` (JSON) - Last draw result
- `status` (VARCHAR) - Game status
- `updated_at` (TIMESTAMP) - Last update time

### `draw_records`
- `period` (VARCHAR) - Lottery period identifier
- `result` (JSONB) - Array of winning numbers
- `draw_time` (TIMESTAMP) - When the draw occurred
- `created_at` (TIMESTAMP) - Record creation time

## Deployment

### Render Deployment

1. Push your code to a Git repository
2. Connect your repository to Render
3. The `render.yaml` file contains all deployment configuration
4. Environment variables are automatically set from the config

### Manual Deployment

1. Build the project:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Configuration

### Database Connection

The database configuration is in `lib/database.ts`. Update the connection details to match your database setup.

### Styling

The website uses Tailwind CSS for styling. Customize the design by:
- Modifying `tailwind.config.js` for theme settings
- Updating `app/globals.css` for global styles
- Editing component classes in the React files

### API Customization

API endpoints are located in `app/api/`. You can:
- Add new endpoints by creating new route files
- Modify existing endpoints for different data formats
- Add authentication if required

## Features Detail

### Countdown Timer
- Real-time countdown to next draw
- Visual progress bar
- Color-coded urgency (green/yellow/red)
- Automatic refresh when countdown completes

### Draw History
- Date-based filtering of results
- Responsive table design
- Animated number displays
- Pagination support (can be extended)

### Real-time Updates
- Automatic refresh every 5 seconds
- Manual refresh capabilities
- Error handling and retry logic
- Loading states for better UX

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Server-side rendering with Next.js
- Optimized database queries
- Efficient state management
- Lazy loading components
- Minimal bundle size

## Security

- Environment variable protection
- SQL injection prevention
- CORS configuration
- Input validation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary software. All rights reserved.

## Support

For technical support or questions about the lottery website, please contact the development team.

---

**Note**: This website is designed to work with an existing Racing10 lottery system and requires access to the specific PostgreSQL database schema described above. 