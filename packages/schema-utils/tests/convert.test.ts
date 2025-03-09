import { convertOpenAISchemaToGemini } from '../lib/helper';
import type { JsonSchemaObject } from '../lib/json_schema';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Create a simple test runner since we don't have Jest or Mocha installed
function describe(name: string, fn: () => void) {
  console.log(`\n--- ${name} ---`);
  fn();
}

function it(name: string, fn: () => void) {
  console.log(`\n  Test: ${name}`);
  try {
    fn();
    console.log('  ✅ PASSED');
  } catch (error) {
    console.error('  ❌ FAILED:', error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function expect(actual: unknown) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toEqual: (expected: unknown) => {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr} but got ${actualStr}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected truthy value but got ${actual}`);
      }
    },
  };
}

describe('convertOpenAISchemaToGemini', () => {
  it('should convert OpenAI schema to Gemini format', () => {
    // Sample OpenAI schema with references and nullable properties
    const openaiSchema: JsonSchemaObject = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the user',
        },
        age: {
          type: 'number',
          description: 'The age of the user',
        },
        address: {
          $ref: '#/$defs/Address',
        },
        email: {
          anyOf: [{ type: 'string', description: 'Email address' }, { type: 'null' }],
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        profile: {
          $ref: '#/$defs/Profile',
        },
      },
      required: ['name', 'age'],
      $defs: {
        Address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            zipCode: { type: 'string' },
          },
          required: ['street', 'city'],
        },
        Profile: {
          type: 'object',
          properties: {
            bio: { type: 'string' },
            website: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
          },
        },
      },
    };

    // Convert the schema
    const geminiSchema = convertOpenAISchemaToGemini(openaiSchema);

    // Expected Gemini schema
    const expectedGeminiSchema: JsonSchemaObject = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the user',
        },
        age: {
          type: 'number',
          description: 'The age of the user',
        },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            zipCode: { type: 'string' },
          },
          required: ['street', 'city'],
        },
        email: {
          type: 'string',
          description: 'Email address',
          nullable: true,
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        profile: {
          type: 'object',
          properties: {
            bio: { type: 'string' },
            website: {
              type: 'string',
              nullable: true,
            },
          },
          required: [],
        },
      },
      required: ['name', 'age'],
    };

    // Verify the conversion
    expect(geminiSchema).toEqual(expectedGeminiSchema);

    // Write the schemas to files for manual inspection
    const testDir = path.join(__dirname, 'output');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    fs.writeFileSync(path.join(testDir, 'openai.json'), JSON.stringify(openaiSchema, null, 2));

    fs.writeFileSync(path.join(testDir, 'gemini.json'), JSON.stringify(geminiSchema, null, 2));
  });

  it('should convert the actual json_schema.ts to gemini.json', () => {
    // Import the actual schema from json_schema.ts
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { jsonNavigatorOutputSchema } = require('../lib/json_schema');

    // Convert the schema
    const geminiSchema = convertOpenAISchemaToGemini(jsonNavigatorOutputSchema);

    // Write the converted schema to a file
    const outputDir = path.join(__dirname, '../');
    fs.writeFileSync(path.join(outputDir, 'gemini.json'), JSON.stringify(geminiSchema, null, 2));

    // Verify the conversion was successful
    expect(geminiSchema).toBeTruthy();
    expect(geminiSchema.properties).toBeTruthy();
  });
});
