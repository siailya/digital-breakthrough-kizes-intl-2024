FROM node:22.11.0-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN yarn install

# Bundle app source
COPY . .

# Build the TypeScript files
RUN yarn build

# Expose port 8080
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]
