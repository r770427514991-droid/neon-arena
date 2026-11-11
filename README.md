# NEON ARENA

3D browser arena prototype. Node.js 20+ required.

Run: npm install then npm start. Open http://localhost:3000.

All visitors to the same server join one arena (32 players maximum).
Five classes, server-controlled movement/combat, pickups, respawn and scoreboard.
Camera: overhead 3D. Desktop keyboard and mouse required.

Public deployment: upload this folder to a GitHub repository and create a Render Web Service using render.yaml (free plan), or use npm install / npm start. An authenticated hosting account is required. The old Netlify static page does not run this server.

This is a prototype: no persistent progress, rooms, matchmaking or mobile controls. Restart resets the arena. Deploy one instance to keep players in the same match.
