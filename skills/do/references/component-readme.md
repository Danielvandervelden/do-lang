# Components

Documentation for shared/complex components in this project.

## When to Document

Document a component when:
- It has non-obvious props or configuration
- It wraps external libraries with custom logic
- It's used widely and has conventions for usage
- It has domain-specific behavior (e.g., FormFields that know about API types)

## Format

Each component doc should include:
- **Purpose**: What the component does
- **Props**: Key props and their types
- **Usage**: Example code showing common patterns
- **Gotchas**: Things that aren't obvious

## Example Entry

See leaselinq-frontend/components/FormFields.md for a good example of documenting form field wrappers.
