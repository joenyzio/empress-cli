# Empress-CLI

## Description

`empress-cli` is a command-line interface (CLI) tool designed to interact seamlessly with xAPI-compliant MongoDB databases. From creating new xAPI records to querying and visualizing data, this tool provides a comprehensive suite of features for managing your xAPI data.

## Features

- **Create New xAPI Records**: Make new xAPI records with ease.
- **Complex Queries**: Search and filter through your xAPI data.
- **Bulk Import**: Mass import xAPI data from a JSON file.
- **Unique Verbs and Actors**: Retrieve a list of all unique verbs and actors from your xAPI records.
- **Data Visualization**: Generate visual reports of your xAPI data.
- **Data Aggregation**: Aggregate your data based on various parameters.

## Prerequisites

- Node.js (v14.0 or higher)
- MongoDB (v4.0 or higher)

## Installation

To install `empress-cli`, follow these steps:

\```bash
git clone https://github.com/yourusername/empress-cli.git
cd empress-cli
npm install
\```

## Setting Up the Environment Variables

Before you can use `empress-cli`, you need to set up some environment variables. Create a `.env` file in the project's root directory and add the following:

\```env
MONGO_URI=mongodb://localhost:27017/myDatabase
MONGO_DB_NAME=myDatabase
MONGO_COLLECTION_NAME=myCollection
LOG_LEVEL=info
JWT_SECRET=YourSuperSecretString
\```

**Note**: The `.env` file contains sensitive information. Do not commit it to your repository. Make sure to add `.env` to your `.gitignore` file.

## Usage

To see a list of all available commands, you can run:

\```bash
empress-cli --help
\```

### Example Commands

**To create a new xAPI record**

\```bash
empress-cli create '{"actor": "John", "verb": "completed", "object": "Course"}'
\```

**To perform a query on xAPI records**

\```bash
empress-cli query '{"actor": "John"}'
\```

## Autocomplete Feature

Run the following script to enable autocomplete features:

\```bash
./activate-autocomplete.sh
\```

## Contributing

Feel free to contribute to this project. Open a pull request or an issue to participate.

## License

This project is licensed under the MIT License.
