import { describe, it, expect } from 'vitest';
import { yamlOverwrite } from 'yaml-diff-patch';
import { parseOpenApi, serializeOpenApi } from '../utils/yamlParser';

describe('Deep nesting and composition', () => {
  it('parses and round-trips a schema with 6 levels of object/array nesting', () => {
    const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    Deep:
      type: object
      properties:
        l1:
          type: array
          items:
            type: object
            properties:
              l2:
                type: array
                items:
                  type: object
                  properties:
                    l3:
                      type: object
                      properties:
                        l4:
                          type: array
                          items:
                            type: object
                            properties:
                              l5:
                                type: string
                                description: leaf
`;
    const doc = parseOpenApi(yaml);
    // Walk down to the leaf and ensure it survived parse.
    const deep = doc.components!.schemas!['Deep'];
    const l1 = deep.properties!['l1'];
    const l2 = l1.items!.properties!['l2'];
    const l3 = l2.items!.properties!['l3'];
    const l4 = l3.properties!['l4'];
    const l5 = l4.items!.properties!['l5'];
    expect(l5.type).toBe('string');
    expect((l5 as Record<string, unknown>).description).toBe('leaf');

    // No-op round-trip is byte-identical.
    const out = yamlOverwrite(yaml, doc as Record<string, unknown>);
    expect(out).toBe(yaml);
  });

  it('preserves allOf → oneOf → anyOf composition chain with $ref', () => {
    const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    A:
      type: object
      properties:
        a:
          type: string
    B:
      type: object
      properties:
        b:
          type: integer
    Composed:
      allOf:
        - $ref: '#/components/schemas/A'
        - oneOf:
            - $ref: '#/components/schemas/B'
            - anyOf:
                - type: object
                  properties:
                    extra:
                      type: string
                - type: object
                  properties:
                    other:
                      type: integer
`;
    const doc = parseOpenApi(yaml);
    const out = yamlOverwrite(yaml, doc as Record<string, unknown>);
    expect(out).toBe(yaml);

    // Structural assertions on the parsed shape.
    const composed = doc.components!.schemas!['Composed'];
    const allOf = (composed as Record<string, unknown>).allOf as unknown[];
    expect(allOf).toHaveLength(2);
    const oneOfWrapper = allOf[1] as Record<string, unknown>;
    const oneOf = oneOfWrapper.oneOf as unknown[];
    expect(oneOf).toHaveLength(2);
  });

  it('handles self-referential $ref without stack overflow', () => {
    const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    TreeNode:
      type: object
      required:
        - value
      properties:
        value:
          type: string
        children:
          type: array
          items:
            $ref: '#/components/schemas/TreeNode'
`;
    const doc = parseOpenApi(yaml);
    const out = yamlOverwrite(yaml, doc as Record<string, unknown>);
    expect(out).toBe(yaml);

    const serialized = serializeOpenApi(doc);
    expect(serialized).toContain("$ref: \"#/components/schemas/TreeNode\"");
  });

  it('preserves the full set of JSON Schema constraints on a single schema', () => {
    const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    FullConstraints:
      type: object
      minProperties: 1
      maxProperties: 20
      additionalProperties: false
      required:
        - name
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 120
          pattern: '^[A-Za-z]+$'
          nullable: false
          readOnly: false
          writeOnly: false
          deprecated: false
        tags:
          type: array
          minItems: 0
          maxItems: 10
          uniqueItems: true
          items:
            type: string
            enum:
              - alpha
              - beta
              - gamma
        score:
          type: number
          minimum: 0
          maximum: 100
          exclusiveMinimum: true
          exclusiveMaximum: false
          multipleOf: 0.5
        color:
          type: string
          const: red
`;
    const doc = parseOpenApi(yaml);
    const out = yamlOverwrite(yaml, doc as Record<string, unknown>);
    expect(out).toBe(yaml);

    const fc = doc.components!.schemas!['FullConstraints'] as Record<string, unknown>;
    const props = fc.properties as Record<string, Record<string, unknown>>;
    expect(props.name.pattern).toBe('^[A-Za-z]+$');
    expect(props.tags.uniqueItems).toBe(true);
    expect(props.score.multipleOf).toBe(0.5);
    expect(props.color.const).toBe('red');
  });

  it('preserves discriminator with mapping', () => {
    const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    Pet:
      oneOf:
        - $ref: '#/components/schemas/Cat'
        - $ref: '#/components/schemas/Dog'
      discriminator:
        propertyName: petType
        mapping:
          cat: '#/components/schemas/Cat'
          dog: '#/components/schemas/Dog'
    Cat:
      type: object
      properties:
        petType:
          type: string
        meow:
          type: boolean
    Dog:
      type: object
      properties:
        petType:
          type: string
        bark:
          type: boolean
`;
    const doc = parseOpenApi(yaml);
    const out = yamlOverwrite(yaml, doc as Record<string, unknown>);
    expect(out).toBe(yaml);
    const pet = doc.components!.schemas!['Pet'] as Record<string, unknown>;
    const disc = pet.discriminator as Record<string, unknown>;
    expect(disc.propertyName).toBe('petType');
    expect((disc.mapping as Record<string, string>).cat).toBe('#/components/schemas/Cat');
  });

  it('shallow edit of a deeply nested schema preserves the rest of the subtree', () => {
    // Simulates the UI making a surface-level change (e.g. updating a title at
    // depth 2) on a schema that also contains data below the SchemaEditor's
    // depth cap of 3. The passthrough data must survive.
    const yaml = `\
openapi: 3.0.3
info:
  title: API
  version: 1.0.0
paths: {}
components:
  schemas:
    Shallow:
      type: object
      title: original-title
      properties:
        nested:
          type: object
          properties:
            deeper:
              type: object
              properties:
                deepest:
                  type: string
                  description: this must survive
`;
    const doc = parseOpenApi(yaml);
    (doc.components!.schemas!['Shallow'] as Record<string, unknown>).title = 'new-title';
    const out = yamlOverwrite(yaml, doc as Record<string, unknown>);
    expect(out).toContain('title: new-title');
    expect(out).toContain('description: this must survive');
    // Structural indentation of the deeper branch is untouched.
    expect(out).toMatch(/ {14}deepest:/);
  });
});
