FROM public.ecr.aws/docker/library/node:20-slim
WORKDIR /app

# Environment variables (NODE_ENV set after build to allow devDependencies install)
ENV DOCKER_CONTAINER=1 \
    AWS_REGION=us-west-2 \
    AWS_DEFAULT_REGION=us-west-2

# Copy source files
COPY . .

# Install all dependencies (including devDependencies for build)
# Use npm ci for reproducible builds when lock file exists, otherwise npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Build TypeScript
RUN npm run build

# Prune dev dependencies and set production mode
RUN npm prune --production
ENV NODE_ENV=production

# Run as non-root user
USER node

EXPOSE 9000
EXPOSE 8000
EXPOSE 8080


CMD ["node", "--require", "@opentelemetry/auto-instrumentations-node/register", "dist/agent_core_entry.js"]
