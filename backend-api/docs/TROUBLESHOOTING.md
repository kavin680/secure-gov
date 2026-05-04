# Troubleshooting Guide

## Common Issues

### Database Connection Failed
```
Error: Can't reach database server at `localhost:5432`
```
**Solution**: Ensure PostgreSQL is running. Use `npm run docker:dev` to start dev databases.

### Prisma Client Not Generated
```
Error: @prisma/client did not initialize yet
```
**Solution**: Run `npm run prisma:generate` after installing dependencies.

### JWT Secret Not Set
```
Error: secretOrPrivateKey must have a value
```
**Solution**: Set `JWT_SECRET` and `JWT_REFRESH_SECRET` in your `.env` file.

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change `APP_PORT` in `.env` or kill the process using port 3000.

### Redis Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**: Either start Redis with `npm run docker:dev` or set `REDIS_ENABLED=false`.

### Migration Issues
```
Error: Migration failed
```
**Solution**: 
1. Reset database: `npx prisma migrate reset`
2. Re-push schema: `npm run prisma:push`

### Rate Limit Exceeded
```
Error: ThrottlerException: Too Many Requests
```
**Solution**: Wait for the rate limit window to reset (60 seconds by default).

## Debug Mode

Start with debug logging:
```bash
LOG_LEVEL=debug npm run start:dev
```

Start with Node.js inspector:
```bash
npm run start:debug
```
