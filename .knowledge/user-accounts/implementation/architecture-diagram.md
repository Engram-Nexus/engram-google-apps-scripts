# User Accounts Architecture Diagram

## System Overview
Complete architecture diagram showing the integration between OAuth 2.1/PKCE authentication, granular authorization, MCP server architecture, and Zero Trust security.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Application"
        CA[Client App]
        PKCE[PKCE Generator]
        ST[Session Token Store]
    end
    
    subgraph "Cloudflare OAuth Provider"
        AUTH[Authorization Server]
        TOKEN[Token Endpoint]
        USERINFO[UserInfo Endpoint]
    end
    
    subgraph "MCP Server Architecture"
        MCP[MCP Server]
        DO[Durable Objects]
        WS[WebSocket Handler]
    end
    
    subgraph "Authorization System"
        RBAC[Role-Based Access Control]
        PERM[Permission Engine]
        DOMAIN[Domain Scoping]
    end
    
    subgraph "Zero Trust Layer"
        ZT[Zero Trust Gateway]
        POLICY[Policy Engine]
        AUDIT[Audit Logger]
    end
    
    subgraph "Session Management"
        SESSION[Session Store]
        REFRESH[Token Refresh]
        REVOKE[Token Revocation]
    end

    %% Authentication Flow
    CA -->|1. Generate PKCE| PKCE
    CA -->|2. Auth Request| AUTH
    AUTH -->|3. User Consent| TOKEN
    TOKEN -->|4. Access Token| CA
    CA -->|5. UserInfo Request| USERINFO
    
    %% MCP Integration
    CA -->|6. MCP Connection| MCP
    MCP -->|7. Session Creation| DO
    DO -->|8. Persistent State| SESSION
    
    %% Authorization
    MCP -->|9. Role Assignment| RBAC
    RBAC -->|10. Permission Check| PERM
    PERM -->|11. Domain Validation| DOMAIN
    
    %% Zero Trust
    PERM -->|12. Policy Check| ZT
    ZT -->|13. Policy Evaluation| POLICY
    POLICY -->|14. Audit Log| AUDIT
    
    %% Token Management
    ST -->|15. Refresh Check| REFRESH
    REFRESH -->|16. New Tokens| TOKEN
    AUDIT -->|17. Revocation Trigger| REVOKE

    classDef client fill:#e1f5fe
    classDef oauth fill:#f3e5f5
    classDef mcp fill:#e8f5e8
    classDef auth fill:#fff3e0
    classDef zt fill:#fce4ec
    classDef session fill:#f1f8e9

    class CA,PKCE,ST client
    class AUTH,TOKEN,USERINFO oauth
    class MCP,DO,WS mcp
    class RBAC,PERM,DOMAIN auth
    class ZT,POLICY,AUDIT zt
    class SESSION,REFRESH,REVOKE session
```

## Detailed Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client App
    participant P as PKCE Generator
    participant A as Auth Server
    participant T as Token Endpoint
    participant M as MCP Server
    participant D as Durable Object
    participant R as RBAC Engine

    Note over C,R: OAuth 2.1 + PKCE Authentication Flow

    C->>P: Generate code_verifier & challenge
    P-->>C: code_verifier, code_challenge
    
    C->>A: Authorization request + PKCE challenge
    Note right of A: User authentication & consent
    A-->>C: Authorization code
    
    C->>T: Token request + code_verifier
    T->>T: Verify PKCE challenge
    T-->>C: Access token + Refresh token
    
    C->>M: Establish MCP connection + token
    M->>M: Validate JWT token
    M->>D: Create user session
    D-->>M: Session ID
    
    M->>R: Request user roles & permissions
    R-->>M: Role assignments + permissions
    M-->>C: MCP session established
    
    Note over C,R: User authenticated with granular permissions
```

## Permission System Architecture

```mermaid
graph LR
    subgraph "Role Hierarchy (60+ Roles)"
        SUPER[Super Admin]
        ORG[Org Admin]
        DOMAIN[Domain Admin]
        USER[Standard User]
        GUEST[Guest User]
    end
    
    subgraph "Permission Domains"
        USERDOM[User Management]
        CONFIGDOM[Configuration]
        AUDITDOM[Audit Access]
        APIDOM[API Access]
    end
    
    subgraph "Permission Actions"
        READ[Read]
        WRITE[Write]
        DELETE[Delete]
        ADMIN[Admin]
    end
    
    subgraph "Domain Scoping"
        GLOBAL[Global Scope]
        ORGSCOPE[Organization Scope]
        TEAMSCOPE[Team Scope]
        PERSONAL[Personal Scope]
    end

    SUPER --> USERDOM
    SUPER --> CONFIGDOM
    SUPER --> AUDITDOM
    SUPER --> APIDOM
    
    ORG --> USERDOM
    ORG --> CONFIGDOM
    ORG --> AUDITDOM
    
    DOMAIN --> USERDOM
    DOMAIN --> CONFIGDOM
    
    USER --> USERDOM
    
    USERDOM --> READ
    USERDOM --> WRITE
    CONFIGDOM --> READ
    CONFIGDOM --> WRITE
    CONFIGDOM --> DELETE
    AUDITDOM --> READ
    APIDOM --> READ
    APIDOM --> WRITE
    APIDOM --> ADMIN
    
    READ --> GLOBAL
    READ --> ORGSCOPE
    WRITE --> ORGSCOPE
    WRITE --> TEAMSCOPE
    DELETE --> TEAMSCOPE
    DELETE --> PERSONAL
    ADMIN --> GLOBAL

    classDef role fill:#e3f2fd
    classDef domain fill:#f1f8e9
    classDef action fill:#fff3e0
    classDef scope fill:#fce4ec

    class SUPER,ORG,DOMAIN,USER,GUEST role
    class USERDOM,CONFIGDOM,AUDITDOM,APIDOM domain
    class READ,WRITE,DELETE,ADMIN action
    class GLOBAL,ORGSCOPE,TEAMSCOPE,PERSONAL scope
```

## MCP Server Session Management

```mermaid
graph TB
    subgraph "Client Layer"
        CLIENT[MCP Client]
        WS_CLIENT[WebSocket Connection]
    end
    
    subgraph "MCP Server Layer"
        WS_SERVER[WebSocket Handler]
        AUTH_MW[Auth Middleware]
        SESSION_MW[Session Middleware]
        HANDLER[Request Handler]
    end
    
    subgraph "Durable Objects Layer"
        DO_SESSION[Session DO]
        DO_USER[User Profile DO]
        DO_PERM[Permission Cache DO]
    end
    
    subgraph "Storage Layer"
        KV_SESSIONS[KV: Sessions]
        KV_TOKENS[KV: Refresh Tokens]
        D1_USERS[D1: User Data]
        D1_AUDIT[D1: Audit Log]
    end

    CLIENT -->|MCP Messages| WS_CLIENT
    WS_CLIENT -->|WebSocket| WS_SERVER
    WS_SERVER -->|JWT Validation| AUTH_MW
    AUTH_MW -->|Session Lookup| SESSION_MW
    SESSION_MW -->|Request Processing| HANDLER
    
    AUTH_MW <-->|Session State| DO_SESSION
    SESSION_MW <-->|User Profile| DO_USER
    HANDLER <-->|Permission Check| DO_PERM
    
    DO_SESSION <-->|Persistent Sessions| KV_SESSIONS
    DO_SESSION <-->|Token Storage| KV_TOKENS
    DO_USER <-->|User Data| D1_USERS
    HANDLER <-->|Audit Trail| D1_AUDIT

    classDef client fill:#e1f5fe
    classDef server fill:#e8f5e8
    classDef durable fill:#fff3e0
    classDef storage fill:#f3e5f5

    class CLIENT,WS_CLIENT client
    class WS_SERVER,AUTH_MW,SESSION_MW,HANDLER server
    class DO_SESSION,DO_USER,DO_PERM durable
    class KV_SESSIONS,KV_TOKENS,D1_USERS,D1_AUDIT storage
```

## Zero Trust Security Integration

```mermaid
graph LR
    subgraph "Request Path"
        REQ[Incoming Request]
        IDENTITY[Identity Verification]
        DEVICE[Device Trust]
        CONTEXT[Context Analysis]
        DECISION[Access Decision]
    end
    
    subgraph "Policy Engine"
        USER_POLICY[User Policies]
        DEVICE_POLICY[Device Policies]
        APP_POLICY[Application Policies]
        RISK_POLICY[Risk Policies]
    end
    
    subgraph "Enforcement Points"
        GATEWAY[Zero Trust Gateway]
        PROXY[Access Proxy]
        FIREWALL[Application Firewall]
    end
    
    subgraph "Monitoring"
        LOGS[Access Logs]
        METRICS[Security Metrics]
        ALERTS[Risk Alerts]
    end

    REQ --> IDENTITY
    IDENTITY --> DEVICE
    DEVICE --> CONTEXT
    CONTEXT --> DECISION
    
    IDENTITY -.-> USER_POLICY
    DEVICE -.-> DEVICE_POLICY
    CONTEXT -.-> APP_POLICY
    CONTEXT -.-> RISK_POLICY
    
    DECISION --> GATEWAY
    GATEWAY --> PROXY
    PROXY --> FIREWALL
    
    GATEWAY --> LOGS
    PROXY --> METRICS
    FIREWALL --> ALERTS

    classDef request fill:#e1f5fe
    classDef policy fill:#f1f8e9
    classDef enforce fill:#fff3e0
    classDef monitor fill:#fce4ec

    class REQ,IDENTITY,DEVICE,CONTEXT,DECISION request
    class USER_POLICY,DEVICE_POLICY,APP_POLICY,RISK_POLICY policy
    class GATEWAY,PROXY,FIREWALL enforce
    class LOGS,METRICS,ALERTS monitor
```

## Security Checkpoints

### Authentication Security
1. **PKCE Implementation**: Code verifier generation and challenge validation
2. **JWT Validation**: Signature, expiration, issuer, and audience verification
3. **Token Refresh**: Secure rotation with refresh token binding
4. **Session Security**: HttpOnly, Secure, SameSite cookie attributes

### Authorization Security
5. **Fail-Closed Defaults**: Default-deny permission model
6. **Principle of Least Privilege**: Minimal required permissions
7. **Domain Scoping**: Granular access control within organizational boundaries
8. **Role Validation**: Dynamic role assignment and verification

### MCP Security
9. **Connection Authentication**: JWT-based MCP connection establishment
10. **Message Integrity**: Request/response validation and signing
11. **Session Isolation**: Durable Objects ensure session separation
12. **Resource Protection**: Fine-grained resource access control

### Zero Trust Security
13. **Continuous Verification**: Ongoing identity and device validation
14. **Context-Aware Access**: Risk-based access decisions
15. **Encrypted Communication**: End-to-end encryption for all traffic
16. **Audit Compliance**: Comprehensive logging and monitoring

## Performance Considerations

### Token Management
- **Access Token Lifetime**: 15-minute expiration for security
- **Refresh Token Rotation**: New refresh token with each use
- **Token Caching**: In-memory caching with automatic invalidation
- **Batch Validation**: Efficient bulk token verification

### Session Performance
- **Durable Objects**: Global distribution for low-latency access
- **Session Persistence**: Automatic state restoration across connections
- **Permission Caching**: Role-based permission caching strategies
- **Connection Pooling**: Efficient WebSocket connection management

### Scalability Patterns
- **Horizontal Scaling**: Stateless authentication for infinite scale
- **Global Distribution**: Edge-based authentication processing
- **Load Balancing**: Intelligent request distribution
- **Auto-scaling**: Dynamic capacity adjustment based on demand

## Implementation Roadmap

### Phase 1: Core Authentication
1. OAuth 2.1/PKCE implementation
2. Cloudflare OAuth Provider integration
3. Basic JWT validation
4. Session establishment

### Phase 2: Authorization System
1. Role hierarchy definition
2. Permission engine implementation
3. Domain scoping configuration
4. Fail-closed security patterns

### Phase 3: MCP Integration
1. Durable Objects session management
2. WebSocket authentication
3. Real-time permission updates
4. Connection lifecycle management

### Phase 4: Zero Trust Enhancement
1. Policy engine integration
2. Continuous verification
3. Risk-based access control
4. Advanced monitoring and alerting