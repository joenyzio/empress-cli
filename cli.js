#!/usr/bin/env node

const { MongoClient } = require("mongodb");
const { program } = require("commander");
const winston = require("winston");
const Ajv = require("ajv");
const inquirer = require("inquirer");
const { Parser } = require("json2csv");
// const omelette = require("omelette");
// const completion = omelette("empress-cli");
require("dotenv").config();

// Initialize AJV and specify xAPI schema
const xAPISchema = {
  type: "object",
  properties: {
    actor: {
      type: "object",
      properties: {
        name: { type: "string" },
        mbox: { type: "string" },
      },
      required: ["name", "mbox"],
    },
    verb: {
      type: "object",
      properties: {
        id: { type: "string" },
        display: { type: "object" },
      },
      required: ["id", "display"],
    },
    object: {
      type: "object",
    },
  },
  required: ["actor", "verb", "object"],
};

const ajv = new Ajv();
const validate = ajv.compile(xAPISchema);

// Initialize Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.Console(),
  ],
});

// Environment Variables
const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;
const collectionName = process.env.COLLECTION_NAME;

if (!uri || !dbName || !collectionName) {
  logger.error(
    "Environment variables MONGO_URI, DB_NAME, or COLLECTION_NAME are not set"
  );
  process.exit(1);
}

const client = new MongoClient(uri);

async function connect() {
  if (!client.isConnected()) {
    try {
      await client.connect();
    } catch (error) {
      logger.error("Could not connect to MongoDB:", error);
      process.exit(1);
    }
  }
}

async function disconnect() {
  if (client.isConnected()) {
    await client.close();
  }
}

async function createRecord(data) {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);

    const valid = validate(data);
    if (!valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validate.errors)}`);
    }

    await collection.insertOne(data);
    logger.info("Record created successfully");
  } catch (error) {
    logger.error("Error while creating record:", error);
  }
}

async function queryRecords(filter) {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const results = await collection.find(JSON.parse(filter)).toArray();
    console.log(results);
  } catch (error) {
    logger.error("Error while querying records:", error);
  }
}

async function bulkInsert(data) {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);

    const validData = data.filter((entry) => validate(entry));
    if (!validData.length) {
      throw new Error("No valid records found");
    }

    await collection.insertMany(validData);
    logger.info(`${validData.length} records inserted successfully`);
  } catch (error) {
    logger.error("Error during bulk insert:", error);
  }
}

// Assuming the MongoClient `client` and other required setups are already in your code

async function listAllVerbs() {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const verbs = await collection.distinct("verb.id");
    console.log(verbs);
    return verbs;
  } catch (error) {
    logger.error("Error fetching unique verbs:", error);
  } finally {
    await client.close();
  }
}

async function listAllActors() {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const actors = await collection.distinct("actor.mbox"); // assuming mbox uniquely identifies actors
    console.log(actors);
    return actors;
  } catch (error) {
    logger.error("Error fetching unique actors:", error);
  } finally {
    await client.close();
  }
}

async function visualizeData(filter) {
  // Placeholder; actual visualization will depend on libraries and tools you're using
  console.log("Visualization for filter:", filter);
}

async function aggregateStatements(pipeline) {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const result = await collection.aggregate(pipeline).toArray();
    console.log(result);
    return result;
  } catch (error) {
    logger.error("Error during aggregation:", error);
  } finally {
    await client.close();
  }
}

async function getLRSStats() {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const count = await collection.countDocuments();
    console.log(`Total statements in LRS: ${count}`);
  } catch (error) {
    logger.error("Error retrieving LRS stats:", error);
  } finally {
    await client.close();
  }
}

async function groupStatementsByDate(filter, granularity) {
  // This will group by day as an example
  const groupBy = {
    $group: {
      _id: {
        year: { $year: "$timestamp" },
        month: { $month: "$timestamp" },
        day: { $dayOfMonth: "$timestamp" },
      },
      count: { $sum: 1 },
    },
  };

  // Adjust based on granularity...

  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const results = await collection.aggregate([groupBy]).toArray();
    console.log(results);
    return results;
  } catch (error) {
    logger.error("Error grouping statements by date:", error);
  } finally {
    await client.close();
  }
}

async function analyzeActivityInteractions(activityId) {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const interactions = await collection
      .find({ "object.id": activityId })
      .toArray();
    console.log(interactions);
    return interactions;
  } catch (error) {
    logger.error("Error analyzing activity interactions:", error);
  } finally {
    await client.close();
  }
}

async function getAverageScoreByActivity(activityId) {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const averageScore = await collection
      .aggregate([
        { $match: { "object.id": activityId } },
        { $group: { _id: null, avgScore: { $avg: "$result.score.scaled" } } },
      ])
      .toArray();

    console.log(averageScore[0].avgScore);
    return averageScore[0].avgScore;
  } catch (error) {
    logger.error("Error getting average score:", error);
  } finally {
    await client.close();
  }
}

const { exec } = require("child_process");

async function checkDatabaseHealth() {
  try {
    await connect();
    // If the connection is successful, the database is healthy.
    console.log("Database is healthy.");
  } catch (error) {
    logger.error("Database health check failed:", error);
  } finally {
    await client.close();
  }
}

function backupDatabase(destinationPath) {
  const cmd = `mongodump --uri=${uri} --db=${dbName} --out=${destinationPath}`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      logger.error("Error during database backup:", error);
      return;
    }
    console.log(`Database backed up successfully to ${destinationPath}`);
  });
}

function restoreDatabaseFromBackup(backupPath) {
  const cmd = `mongorestore --uri=${uri} --db=${dbName} ${backupPath}/${dbName}`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      logger.error("Error during database restore:", error);
      return;
    }
    console.log("Database restored successfully from backup.");
  });
}

async function resetDatabase() {
  try {
    const response = await inquirer.prompt({
      type: "confirm",
      name: "reset",
      message: "WARNING: This will purge all records. Are you sure?",
    });

    if (response.reset) {
      await connect();
      const result = await client
        .db(dbName)
        .collection(collectionName)
        .deleteMany({});
      console.log(`Deleted ${result.deletedCount} records.`);
    } else {
      console.log("Database reset cancelled.");
    }
  } catch (error) {
    logger.error("Error during database reset:", error);
  } finally {
    await client.close();
  }
}

async function bulkStoreStatements(data) {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);

    const validData = data.filter((entry) => validate(entry));
    if (!validData.length) {
      throw new Error("No valid records found");
    }

    await collection.insertMany(validData);
    logger.info(`${validData.length} records inserted successfully`);
  } catch (error) {
    logger.error("Error during bulk store:", error);
  } finally {
    await client.close();
  }
}

async function exportStatements(filter, format) {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);

    const results = await collection.find(JSON.parse(filter)).toArray();

    switch (format.toLowerCase()) {
      case "csv":
        const parser = new Parser();
        const csv = parser.parse(results);
        fs.writeFileSync("exported_statements.csv", csv);
        break;
      case "json":
      default:
        fs.writeFileSync(
          "exported_statements.json",
          JSON.stringify(results, null, 2)
        );
        break;
    }
    logger.info(`Exported statements in ${format} format.`);
  } catch (error) {
    logger.error("Error during export:", error);
  } finally {
    await client.close();
  }
}

async function importStatements(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = JSON.parse(fileContent);
    await bulkStoreStatements(jsonData);
  } catch (error) {
    logger.error("Error during import:", error);
  }
}

// Assuming a simple structure for verb and activity type registration
async function registerNewVerb(verb, definition) {
  try {
    await connect();
    const collection = client.db(dbName).collection("verbs");
    await collection.insertOne({ verb, definition });
    logger.info(`Registered new verb: ${verb}`);
  } catch (error) {
    logger.error("Error during verb registration:", error);
  } finally {
    await client.close();
  }
}

async function registerNewActivityType(type, definition) {
  try {
    await connect();
    const collection = client.db(dbName).collection("activityTypes");
    await collection.insertOne({ type, definition });
    logger.info(`Registered new activity type: ${type}`);
  } catch (error) {
    logger.error("Error during activity type registration:", error);
  } finally {
    await client.close();
  }
}

// Sample validateStatement function (may need to align with ADL standards)
function validateStatement(data) {
  const isValid = validate(data); // Reuse the AJV validator from earlier code
  if (isValid) {
    return { valid: true };
  } else {
    return { valid: false, errors: validate.errors };
  }
}

// Sample checkStatementAgainstProfile function (it's a stub, you'd need to implement profile-specific logic)
function checkStatementAgainstProfile(profileId, statement) {
  // Implement logic to check a statement against a specific xAPI profile based on profileId
  return true; // Assuming the statement is valid against the profile for simplicity
}

// ... other imports and initializations ...

async function interactiveMode() {
  const questions = [
    {
      type: "input",
      name: "actorName",
      message: "What is the actor name?",
    },
    {
      type: "input",
      name: "actorMbox",
      message: "What is the actor mbox?",
    },
    {
      type: "input",
      name: "verbId",
      message:
        "What is the verb id (e.g., http://adlnet.gov/expapi/verbs/completed)?",
    },
    {
      type: "input",
      name: "objectName",
      message: "What is the object name?",
    },
    // ... Add more questions here based on your requirements ...
  ];

  const answers = await inquirer.prompt(questions);

  const statement = {
    actor: {
      name: answers.actorName,
      mbox: answers.actorMbox,
    },
    verb: {
      id: answers.verbId,
      display: {
        "en-US": "Assuming English here; adjust as needed",
      },
    },
    object: {
      objectType: "Activity",
      name: answers.objectName,
      // ... other object properties ...
    },
    // ... Add other statement properties if needed ...
  };

  return statement;
}

function generateStatementTemplate() {
  const template = {
    actor: {
      name: "INSERT_ACTOR_NAME",
      mbox: "INSERT_ACTOR_MBOX",
    },
    verb: {
      id: "INSERT_VERB_ID",
      display: {
        "en-US": "INSERT_DISPLAY_TEXT",
      },
    },
    object: {
      objectType: "Activity",
      // ... other object properties ...
    },
    // ... Add other statement properties if needed ...
  };

  return template;
}

async function searchStatementsByContent(query) {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);

    const results = await collection
      .find({ $text: { $search: query } })
      .toArray();

    return results;
  } catch (error) {
    logger.error("Error during full-text search:", error);
  } finally {
    await client.close();
  }
}

const { ObjectId } = require("mongodb"); // If you need to use actorId

//  Additional Features

async function listAllObjectTypes() {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const objectTypes = await collection.distinct("object.objectType");
    return objectTypes;
  } catch (error) {
    logger.error("Error fetching object types:", error);
  } finally {
    await client.close();
  }
}

async function visualizeActorProgress(actorId) {
  // This function assumes a specific structure for progress, such as timestamp and some progress metric.
  // You'll need to adjust according to your xAPI structure.
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const progressData = await collection
      .find({ "actor.id": ObjectId(actorId) })
      .sort({ timestamp: 1 })
      .toArray();

    // Visualization logic here - this would depend on your visualization tool or library.
    return progressData;
  } catch (error) {
    logger.error("Error visualizing actor progress:", error);
  } finally {
    await client.close();
  }
}

async function setStatementAuthority(statementId, authority) {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    await collection.updateOne(
      { _id: ObjectId(statementId) },
      { $set: { authority: authority } }
    );
  } catch (error) {
    logger.error("Error setting statement authority:", error);
  } finally {
    await client.close();
  }
}

async function getMostActiveActors() {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const actors = await collection
      .aggregate([
        { $group: { _id: "$actor.mbox", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();
    return actors;
  } catch (error) {
    logger.error("Error fetching most active actors:", error);
  } finally {
    await client.close();
  }
}

async function visualizeVerbUsage(filter) {
  // The exact implementation would depend on your visualization tool.
  // Here's a basic aggregation to get verb usage.
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const verbUsage = await collection
      .aggregate([
        { $match: filter },
        { $group: { _id: "$verb.id", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Visualization logic here
    return verbUsage;
  } catch (error) {
    logger.error("Error visualizing verb usage:", error);
  } finally {
    await client.close();
  }
}

async function listAllExtensions() {
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const extensions = await collection.distinct("object.extensions");
    return extensions;
  } catch (error) {
    logger.error("Error listing all extensions:", error);
  } finally {
    await client.close();
  }
}

async function getStatementsByDuration(minDuration, maxDuration) {
  // This assumes your xAPI statements have a "duration" property.
  try {
    await connect();
    const collection = client.db(dbName).collection(collectionName);
    const statements = await collection
      .find({ duration: { $gte: minDuration, $lte: maxDuration } })
      .toArray();
    return statements;
  } catch (error) {
    logger.error("Error retrieving statements by duration:", error);
  } finally {
    await client.close();
  }
}

// Cleanup: Disconnect on exit
process.on("exit", disconnect);

// Define your max size for database health check
const YOUR_MAX_SIZE = 1000000000; // Example value, adjust accordingly

async function checkDatabaseHealth() {
  try {
    await connect();
    const stats = await client.db(dbName).stats();

    if (stats.storageSize > YOUR_MAX_SIZE) {
      logger.warn("Database size exceeds recommended limit!");
    } else {
      logger.info("Database health is good.");
    }
  } catch (error) {
    logger.error("Error during health check:", error);
  } finally {
    await client.close();
  }
}

async function mainMenu() {
  const { selectedCommand } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedCommand",
      message: "What would you like to do?",
      choices: [
        "Interactively generate an xAPI statement",
        "Generate an xAPI statement template",
        "Search for statements by content",
        "List all object types in the LRS",
        "Visualize the progress of an actor",
        "Set the authority for an xAPI statement",
        "Get the most active actors",
        "Visualize verb usage",
        "List all extensions",
        "Get statements by duration",
        "Exit",
      ],
    },
  ]);

  switch (selectedCommand) {
    case "Interactively generate an xAPI statement":
      const statement = await interactiveMode();
      console.log("Generated statement:", JSON.stringify(statement, null, 2));
      break;
    // ... other cases based on the choices
    case "Exit":
      console.log("Exiting the program. Goodbye!");
      process.exit(0);
      break;
  }

  // Loop back to main menu
  await mainMenu();
}

// Run the main menu when the script starts
mainMenu().catch((err) => {
  console.error("An error occurred:", err);
  process.exit(1);
});

// Automated task that runs every hour
// setInterval(async () => {
//   await checkDatabaseHealth();
// }, 1000 * 60 * 60);

// Set up CLI commands
program.version("0.0.1");

program
  .command("create <data>")
  .description("Create a new xAPI record")
  .action(async (data) => {
    try {
      const jsonData = JSON.parse(data);
      await createRecord(jsonData);
    } catch (error) {
      logger.error("Error during record creation:", error);
    }
  });

program
  .command("query <parameters>")
  .description("Perform complex queries based on provided parameters")
  .action(async (parameters) => {
    await queryRecords(parameters);
  });

program
  .command("bulkImport <filepath>")
  .description("Bulk import xAPI data from a JSON file")
  .action(async (filepath) => {
    try {
      const jsonData = JSON.parse(fs.readFileSync(filepath, "utf-8"));
      await bulkInsert(jsonData);
    } catch (error) {
      logger.error("Error during bulk import:", error);
    }
  });

// Basic Functions

program
  .command("listVerbs")
  .description("List all unique verbs used in stored xAPI statements")
  .action(async () => {
    const verbs = await listAllVerbs();
    console.log(verbs);
  });

program
  .command("listActors")
  .description("List all unique actors from the xAPI statements")
  .action(async () => {
    const actors = await listAllActors();
    console.log(actors);
  });

program
  .command("visualizeData <filter>")
  .description("Provide basic visualization of xAPI data")
  .action(async (filter) => {
    await visualizeData(filter);
  });

program
  .command("aggregate <pipeline>")
  .description("Perform aggregation operations on xAPI data")
  .action(async (pipeline) => {
    const result = await aggregateStatements(pipeline);
    console.log(result);
  });

program
  .command("lrsStats")
  .description("Retrieve insights about the Learning Record Store")
  .action(async () => {
    const stats = await getLRSStats();
    console.log(stats);
  });

program
  .command("groupByDate <filter> <granularity>")
  .description("Group xAPI statements by date")
  .action(async (filter, granularity) => {
    const groupedStatements = await groupStatementsByDate(filter, granularity);
    console.log(groupedStatements);
  });

program
  .command("analyzeActivity <activityId>")
  .description("Report on interactions related to an activity")
  .action(async (activityId) => {
    const report = await analyzeActivityInteractions(activityId);
    console.log(report);
  });

program
  .command("avgScoreByActivity <activityId>")
  .description("Retrieve average score for a specific activity")
  .action(async (activityId) => {
    const avgScore = await getAverageScoreByActivity(activityId);
    console.log(avgScore);
  });

// For Advanced Analysis:

program
  .command("listVerbs")
  .description("List all unique verbs used in stored xAPI statements")
  .action(async () => {
    const verbs = await listAllVerbs();
    console.log(verbs);
  });

program
  .command("listActors")
  .description("List all unique actors from the xAPI statements")
  .action(async () => {
    const actors = await listAllActors();
    console.log(actors);
  });

program
  .command("visualizeData <filter>")
  .description("Provide basic visualization of xAPI data")
  .action(async (filter) => {
    await visualizeData(filter);
  });

program
  .command("aggregate <pipeline>")
  .description("Perform aggregation operations on xAPI data")
  .action(async (pipeline) => {
    const result = await aggregateStatements(pipeline);
    console.log(result);
  });

program
  .command("lrsStats")
  .description("Retrieve insights about the Learning Record Store")
  .action(async () => {
    const stats = await getLRSStats();
    console.log(stats);
  });

program
  .command("groupByDate <filter> <granularity>")
  .description("Group xAPI statements by date")
  .action(async (filter, granularity) => {
    const groupedStatements = await groupStatementsByDate(filter, granularity);
    console.log(groupedStatements);
  });

program
  .command("analyzeActivity <activityId>")
  .description("Report on interactions related to an activity")
  .action(async (activityId) => {
    const report = await analyzeActivityInteractions(activityId);
    console.log(report);
  });

program
  .command("avgScoreByActivity <activityId>")
  .description("Retrieve average score for a specific activity")
  .action(async (activityId) => {
    const avgScore = await getAverageScoreByActivity(activityId);
    console.log(avgScore);
  });

// For Database Management

program
  .command("check-health")
  .description("Check the health of the xAPI database")
  .action(async () => {
    await checkDatabaseHealth();
  });

program
  .command("backup <destinationPath>")
  .description("Create a backup of the xAPI records")
  .action(async (destinationPath) => {
    await backupDatabase(destinationPath);
    console.log(`Database backed up to ${destinationPath}`);
  });

program
  .command("restore <backupPath>")
  .description("Restore xAPI records from a backup")
  .action(async (backupPath) => {
    await restoreDatabaseFromBackup(backupPath);
    console.log(`Database restored from ${backupPath}`);
  });

program
  .command("reset-db")
  .description("Purge all records (with warnings and confirmations)")
  .action(async () => {
    const response = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmReset",
        message:
          "Are you sure you want to purge all records? This action is irreversible.",
        default: false,
      },
    ]);

    if (response.confirmReset) {
      await resetDatabase();
      console.log("Database records purged.");
    } else {
      console.log("Operation cancelled.");
    }
  });

// ... Your existing setup and other functions ...

// For Import & Export:

program
  .command("bulk-store <data>")
  .description("Store multiple xAPI statements at once")
  .action(async (data) => {
    const jsonData = JSON.parse(data);
    await bulkStoreStatements(jsonData);
    console.log("Statements stored successfully.");
  });

program
  .command("export-statements <filter> <format>")
  .description("Export xAPI statements to a chosen format (e.g., JSON, CSV)")
  .action(async (filter, format) => {
    await exportStatements(filter, format);
    console.log(`Statements exported in ${format} format.`);
  });

program
  .command("import-statements <filePath>")
  .description("Import xAPI statements from a file")
  .action(async (filePath) => {
    await importStatements(filePath);
    console.log(`Statements imported from ${filePath}.`);
  });

// For Profile & Standards Management

program
  .command("validate <data>")
  .description("Check if xAPI statement conforms to ADL standards")
  .action(async (data) => {
    const jsonData = JSON.parse(data);
    await validateStatement(jsonData);
    console.log("Statement validation complete.");
  });

program
  .command("register-verb <verb> <definition>")
  .description("Register new verbs")
  .action(async (verb, definition) => {
    await registerNewVerb(verb, definition);
    console.log(`Verb '${verb}' registered successfully.`);
  });

program
  .command("register-activity-type <type> <definition>")
  .description("Register new activity types")
  .action(async (type, definition) => {
    await registerNewActivityType(type, definition);
    console.log(`Activity type '${type}' registered successfully.`);
  });

program
  .command("check-profile <profileId> <statement>")
  .description("Check statement against an xAPI profile")
  .action(async (profileId, statement) => {
    const jsonData = JSON.parse(statement);
    await checkStatementAgainstProfile(profileId, jsonData);
    console.log("Statement checked against the profile.");
  });

program
  .command("interactive-mode")
  .description("Interactively generate an xAPI statement")
  .action(async () => {
    const statement = await interactiveMode();
    console.log("Generated statement:", JSON.stringify(statement, null, 2));
  });

program
  .command("generate-template")
  .description("Generate an xAPI statement template")
  .action(() => {
    const template = generateStatementTemplate();
    console.log("Generated template:", JSON.stringify(template, null, 2));
  });

program
  .command("search-statements <query>")
  .description("Search for statements by content")
  .action(async (query) => {
    const results = await searchStatementsByContent(query);
    console.log("Search Results:", results);
  });

program
  .command("list-object-types")
  .description("List all object types in the LRS")
  .action(async () => {
    const types = await listAllObjectTypes();
    console.log("Object Types:", types);
  });

program
  .command("visualize-actor-progress <actorId>")
  .description("Visualize the progress of an actor")
  .action(async (actorId) => {
    const progressData = await visualizeActorProgress(actorId);
    console.log("Progress Data:", progressData);
    // Add logic for actual visualization here
  });

program
  .command("set-statement-authority <statementId> <authority>")
  .description("Set the authority for an xAPI statement")
  .action(async (statementId, authority) => {
    await setStatementAuthority(statementId, authority);
    console.log(`Authority set for statement ${statementId}.`);
  });

program
  .command("most-active-actors")
  .description("Get the most active actors")
  .action(async () => {
    const actors = await getMostActiveActors();
    console.log("Most Active Actors:", actors);
  });

program
  .command("visualize-verb-usage")
  .description("Visualize verb usage")
  .action(async () => {
    const filter = {}; // Define filter based on your needs
    const verbUsage = await visualizeVerbUsage(filter);
    console.log("Verb Usage:", verbUsage);
    // Add logic for actual visualization here
  });

program
  .command("list-all-extensions")
  .description("List all extensions")
  .action(async () => {
    const extensions = await listAllExtensions();
    console.log("Extensions:", extensions);
  });

program
  .command("get-statements-by-duration <minDuration> <maxDuration>")
  .description("Get statements by duration")
  .action(async (minDuration, maxDuration) => {
    const statements = await getStatementsByDuration(minDuration, maxDuration);
    console.log("Statements:", statements);
  });

// completion

// completion.on("create", function () {
//   // Replace these with the keys your JSON data object might contain
//   this.reply(["name", "email", "score"]);
// });

// // At the end of your cli.js
// completion.on("complete", function (fragments, { line, reply }) {
//   // Your custom completion logic here
//   // Use reply() to send back the completion candidates
// });

// completion.init();
// completion.setupShellInitFile();
program.parse(process.argv);
