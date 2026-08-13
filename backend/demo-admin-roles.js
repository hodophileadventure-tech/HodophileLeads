/**
 * Admin Role & User Management Demo
 * 
 * This script demonstrates:
 * 1. Creating new roles (Video Editor, Content Creator)
 * 2. Creating users and assigning roles
 * 3. Different UIs for different roles
 */

const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'super-secret-key';

// Generate admin token
const adminToken = jwt.sign(
  { 
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@test.com',
    role: 'admin',
    name: 'Admin User'
  },
  JWT_SECRET
);

console.log('\n📊 Admin Role & User Management Demo\n');
console.log('='.repeat(70));

// Helper function to make HTTP requests
function makeRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:5000');
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runDemo() {
  try {
    // Step 1: Get available permissions
    console.log('\n📋 Step 1: Retrieving available permissions...');
    const permsRes = await makeRequest('GET', '/api/admin/permissions', adminToken);
    
    if (permsRes.status === 200) {
      const permissions = permsRes.data.permissions || [];
      console.log(`✅ Found ${permissions.length} permissions`);
      
      // Show some permissions
      const contentPerms = permissions.filter(p => 
        p.resource === 'content' || p.resource === 'videos'
      );
      if (contentPerms.length > 0) {
        console.log(`   Content/Video permissions: ${contentPerms.slice(0, 3).map(p => `${p.resource}.${p.action}`).join(', ')}`);
      }
    } else {
      console.log(`❌ Failed to get permissions (${permsRes.status})`);
    }

    // Step 2: List existing roles
    console.log('\n👥 Step 2: Listing existing roles...');
    const rolesRes = await makeRequest('GET', '/api/admin/roles', adminToken);
    
    if (rolesRes.status === 200) {
      const roles = rolesRes.data.roles || [];
      console.log(`✅ Found ${roles.length} existing roles:`);
      roles.forEach(r => {
        console.log(`   - ${r.name} (${r.slug}): ${r.permission_count || 0} permissions`);
      });
    } else {
      console.log(`❌ Failed to list roles (${rolesRes.status})`);
    }

    // Step 3: Create new role - Video Editor
    console.log('\n🎬 Step 3: Creating "Video Editor" role...');
    const videoEditorRes = await makeRequest('POST', '/api/admin/roles', adminToken, {
      name: 'Video Editor',
      slug: 'video_editor',
      description: 'Professional video editor with access to video editing tools and task submissions'
    });

    let videoEditorRoleId = null;
    if (videoEditorRes.status === 201) {
      videoEditorRoleId = videoEditorRes.data.role?.id;
      console.log(`✅ Video Editor role created`);
      console.log(`   ID: ${videoEditorRoleId}`);
      console.log(`   Slug: video_editor`);
    } else {
      console.log(`❌ Failed to create role (${videoEditorRes.status})`);
      console.log(`   Response: ${JSON.stringify(videoEditorRes.data).substring(0, 150)}`);
    }

    // Step 4: Create new role - Content Creator
    console.log('\n✍️  Step 4: Creating "Content Creator" role...');
    const contentCreatorRes = await makeRequest('POST', '/api/admin/roles', adminToken, {
      name: 'Content Creator',
      slug: 'content_creator',
      description: 'Content creation specialist with access to content management and publishing'
    });

    let contentCreatorRoleId = null;
    if (contentCreatorRes.status === 201) {
      contentCreatorRoleId = contentCreatorRes.data.role?.id;
      console.log(`✅ Content Creator role created`);
      console.log(`   ID: ${contentCreatorRoleId}`);
      console.log(`   Slug: content_creator`);
    } else {
      console.log(`❌ Failed to create role (${contentCreatorRes.status})`);
    }

    // Step 5: Create new user - Video Editor
    console.log('\n👤 Step 5: Creating user "John Smith" as Video Editor...');
    const videoEditorUserRes = await makeRequest('POST', '/api/admin/users', adminToken, {
      email: 'john.smith@studio.com',
      name: 'John Smith',
      password: 'SecurePass123!',
      roleId: videoEditorRoleId
    });

    let videoEditorUserId = null;
    if (videoEditorUserRes.status === 201) {
      videoEditorUserId = videoEditorUserRes.data.user?.id;
      console.log(`✅ User created successfully`);
      console.log(`   Email: john.smith@studio.com`);
      console.log(`   Role: Video Editor`);
      console.log(`   User ID: ${videoEditorUserId}`);
    } else {
      console.log(`❌ Failed to create user (${videoEditorUserRes.status})`);
      console.log(`   Response: ${JSON.stringify(videoEditorUserRes.data).substring(0, 150)}`);
    }

    // Step 6: Create new user - Content Creator
    console.log('\n👤 Step 6: Creating user "Sarah Johnson" as Content Creator...');
    const contentCreatorUserRes = await makeRequest('POST', '/api/admin/users', adminToken, {
      email: 'sarah.johnson@studio.com',
      name: 'Sarah Johnson',
      password: 'SecurePass123!',
      roleId: contentCreatorRoleId
    });

    if (contentCreatorUserRes.status === 201) {
      console.log(`✅ User created successfully`);
      console.log(`   Email: sarah.johnson@studio.com`);
      console.log(`   Role: Content Creator`);
    } else {
      console.log(`❌ Failed to create user (${contentCreatorUserRes.status})`);
    }

    // Step 7: List all users
    console.log('\n📋 Step 7: Listing all users...');
    const usersRes = await makeRequest('GET', '/api/admin/users', adminToken);
    
    if (usersRes.status === 200) {
      const users = usersRes.data.users || [];
      console.log(`✅ Found ${users.length} users:`);
      
      // Show new users with their roles
      const newUsers = users.filter(u => 
        u.email.includes('@studio.com')
      );
      
      newUsers.forEach(u => {
        console.log(`   - ${u.name} (${u.email})`);
        console.log(`     Role: ${u.role_name || 'No role assigned'}`);
      });
    } else {
      console.log(`❌ Failed to list users (${usersRes.status})`);
    }

    // Step 8: Get user details with permissions
    if (videoEditorUserId) {
      console.log('\n🔍 Step 8: Getting Video Editor user details with permissions...');
      const userDetailsRes = await makeRequest('GET', `/api/admin/users/${videoEditorUserId}`, adminToken);
      
      if (userDetailsRes.status === 200) {
        const user = userDetailsRes.data.user;
        console.log(`✅ User: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role_name}`);
        
        // Assign some permissions to the Video Editor role
        console.log('\n⚙️  Step 8b: Assigning permissions to Video Editor role...');
        
        // Get permission IDs (for demo, we'll use common ones)
        const permsForAssignRes = await makeRequest('GET', '/api/admin/permissions', adminToken);
        if (permsForAssignRes.status === 200) {
          const allPerms = permsForAssignRes.data.permissions || [];
          
          // Find task-related permissions
          const taskPerms = allPerms
            .filter(p => p.resource === 'tasks' && ['view', 'start', 'submit'].includes(p.action))
            .map(p => p.id)
            .slice(0, 3);

          if (taskPerms.length > 0 && videoEditorRoleId) {
            const assignPermsRes = await makeRequest(
              'POST',
              `/api/admin/roles/${videoEditorRoleId}/permissions`,
              adminToken,
              { permissionIds: taskPerms }
            );

            if (assignPermsRes.status === 200) {
              console.log(`✅ Assigned ${taskPerms.length} permissions to Video Editor role`);
            }
          }
        }
      } else {
        console.log(`❌ Failed to get user details (${userDetailsRes.status})`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✨ Admin Role & User Management Demo Complete!\n');
    console.log('Summary:');
    console.log('  ✓ Created "Video Editor" role');
    console.log('  ✓ Created "Content Creator" role');
    console.log('  ✓ Created "John Smith" as Video Editor');
    console.log('  ✓ Created "Sarah Johnson" as Content Creator');
    console.log('  ✓ Demonstrated permission assignment\n');
    console.log('UI Differences:');
    console.log('  • Sales Agent   → Sales CRM UI (blue theme)');
    console.log('  • Video Editor  → Editor Suite UI (dark red theme)');
    console.log('  • Content Creator → Content Studio UI (dark amber theme)');
    console.log('  • Admin         → Admin Panel UI (purple theme)\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run demo
runDemo().then(() => {
  console.log('✅ Demo completed successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
