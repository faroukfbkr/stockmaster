# Security Specification - StockMaster

## 1. Data Invariants

1. **Owner Isolation (Row-Level Security)**: Every Product and StockMovement document must have a `userId` field matching the authenticated user's UID (`request.auth.uid`). No user can read, list, create, update, or delete another user's documents.
2. **Mandatory Product Schema**:
   - `barcode` must be a string of size 3 to 100 characters.
   - `name` must be a string of size 1 to 200 characters.
   - `costPrice` must be a number >= 0.
   - `sellingPrice` must be a number >= 0.
   - `quantity` must be a number.
   - `unit` must be a string of size 1 to 50 characters.
   - `userId` must equal `request.auth.uid`.
3. **Mandatory StockMovement Schema**:
   - `productId` must be a valid document ID (matching `^[a-zA-Z0-9_\-]+$`).
   - `type` must be one of `"restock"`, `"sale"`, `"adjustment"`.
   - `quantityChange` must be a number.
   - `priceAtTime` must be a number >= 0.
   - `userId` must equal `request.auth.uid`.
4. **Audit Immutability**: StockMovements are historic audit records and are strictly **Read-Once, Write-Once**. Updates and deletions of StockMovement documents are **FORBIDDEN**.

---

## 2. The "Dirty Dozen" Malicious Payloads (Forbidden Actions)

### Payload 1: Unauthenticated Read
An anonymous, unauthenticated user trying to read any product.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 2: Cross-Tenant Data Leak (Read)
An authenticated user (`user_A`) attempting to read a product document belonging to `user_B`.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 3: Cross-Tenant Data Forgery (Write)
An authenticated user (`user_A`) attempting to create a product specifying `userId: "user_B"`.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 4: Overwriting Tenant Identity on Update
An authenticated user (`user_A`) attempting to change the `userId` field of a product to `user_B`.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 5: Audit Log Deletion
An authenticated user trying to delete a historical `StockMovement` log.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 6: Audit Log Manipulation (Update)
An authenticated user attempting to edit an existing `StockMovement` (e.g., changing quantityChange from `-5` to `-1`).
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 7: Denial of Wallet (Size Exhaustion)
An authenticated user attempting to save a product with a `name` longer than 200 characters or containing a 10KB string to bloat database size.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 8: Invalid Enum Injection
An authenticated user attempting to log a `StockMovement` with type `"stolen"`, which is not in the allowed list of types (`restock`, `sale`, `adjustment`).
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 9: Invalid Data Types
An authenticated user attempting to create a product where `sellingPrice` is a string (e.g., `"19.99"`) or `quantity` is a boolean (e.g., `true`).
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 10: Negative Pricing
An authenticated user attempting to create a product with a negative `costPrice` or negative `sellingPrice` (e.g., `-15.00`).
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 11: Missing Required Keys (Schema Bypass)
An authenticated user attempting to create a product without the mandatory `barcode` or `unit` field to bypass validations.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 12: Injection Attack on Doc ID
An authenticated user attempting to create a document with a malicious ID structure (e.g., length > 128 characters or containing path traversal characters).
- **Expected Outcome**: `PERMISSION_DENIED`
