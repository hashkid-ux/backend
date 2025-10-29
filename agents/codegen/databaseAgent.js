class DatabaseAgent {
  async designSchema(projectData) {
    const prompt = `Design PostgreSQL database schema for: ${projectData.description}

Generate:
1. Prisma schema
2. SQL migrations
3. Seed data

Return JSON format with tables, columns, relationships`;

    // Similar Claude API call
  }
}