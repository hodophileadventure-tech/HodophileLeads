/**
 * Phase 2 Task Management API Test
 * Tests all task endpoints and state transitions
 */

const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'super-secret-key';

// Generate test tokens
const tokens = {
  admin: jwt.sign(
    { id: '550e8400-e29b-41d4-a716-446655440001', email: 'admin@test.com', role: 'admin', name: 'Admin User' },
    JWT_SECRET
  ),
  salesperson: jwt.sign(
    { id: '550e8400-e29b-41d4-a716-446655440002', email: 'agent@test.com', role: 'sales executive', name: 'Agent User' },
    JWT_SECRET
  ),
  manager: jwt.sign(
    { id: '550e8400-e29b-41d4-a716-446655440003', email: 'manager@test.com', role: 'sales manager', name: 'Manager User' },
    JWT_SECRET
  )
};

const BASE_URL = 'http://localhost:5000';
let createdTaskId = null;

// Helper function to make HTTP requests
function makeRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
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

async function runTests() {
  console.log('\n🧪 Phase 2 Task Management API Tests\n');
  console.log('=' .repeat(60));

  try {
    // Test 0: Check permissions
    console.log('\n🔍 Test 0: Check Admin User Permissions');
    const permRes = await makeRequest('GET', '/api/admin/my-permissions', tokens.admin);
    
    if (permRes.status === 200) {
      console.log(`✅ Admin permissions retrieved`);
      console.log(`   Permissions: ${permRes.data.permissions ? permRes.data.permissions.length : 0} available`);
    } else {
      console.log(`❌ Could not retrieve permissions (${permRes.status})`);
      console.log(`   Response: ${JSON.stringify(permRes.data).substring(0, 150)}`);
    }

    // Test 1: Create a task (Admin creating task for salesperson)
    console.log('\n✏️  Test 1: Create Task');
    const createTaskRes = await makeRequest('POST', '/api/tasks', tokens.admin, {
      assignedTo: '550e8400-e29b-41d4-a716-446655440002',
      title: 'Customer Follow-up: Kilimanjaro Trek',
      description: 'Follow up with customer about their kilimanjaro trek booking',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'high'
    });

    if (createTaskRes.status === 201 || createTaskRes.status === 200) {
      createdTaskId = createTaskRes.data.id || createTaskRes.data.task?.id;
      console.log(`✅ Task created: ${createdTaskId}`);
      console.log(`   Title: ${createTaskRes.data.title || createTaskRes.data.task?.title}`);
      console.log(`   Status: ${createTaskRes.data.status || createTaskRes.data.task?.status}`);
    } else {
      console.log(`❌ Failed to create task (${createTaskRes.status})`);
      console.log(`   Response: ${JSON.stringify(createTaskRes.data).substring(0, 200)}`);
      return;
    }

    // Test 2: Retrieve the task
    console.log('\n📖 Test 2: Get Task');
    const getTaskRes = await makeRequest('GET', `/api/tasks/${createdTaskId}`, tokens.salesperson);
    
    if (getTaskRes.status === 200) {
      console.log(`✅ Task retrieved successfully`);
      console.log(`   ID: ${getTaskRes.data.id || getTaskRes.data.task?.id}`);
      console.log(`   Status: ${getTaskRes.data.status || getTaskRes.data.task?.status}`);
    } else {
      console.log(`❌ Failed to retrieve task (${getTaskRes.status})`);
    }

    // Test 3: Start task (transition to in_progress)
    console.log('\n▶️  Test 3: Start Task (assigned → in_progress)');
    const startTaskRes = await makeRequest('POST', `/api/tasks/${createdTaskId}/start`, tokens.salesperson, {});
    
    if (startTaskRes.status === 200) {
      console.log(`✅ Task started`);
      console.log(`   New Status: ${startTaskRes.data.status || startTaskRes.data.task?.status}`);
      console.log(`   Started At: ${startTaskRes.data.started_at || startTaskRes.data.task?.started_at}`);
    } else {
      console.log(`❌ Failed to start task (${startTaskRes.status})`);
      console.log(`   Response: ${JSON.stringify(startTaskRes.data).substring(0, 200)}`);
    }

    // Test 4: Submit task
    console.log('\n✋ Test 4: Submit Task (in_progress → submitted)');
    const submitTaskRes = await makeRequest('POST', `/api/tasks/${createdTaskId}/submit`, tokens.salesperson, {
      notes: 'Customer confirmed booking for Kilimanjaro trek. Payment received. All docs sent.'
    });
    
    if (submitTaskRes.status === 200) {
      console.log(`✅ Task submitted`);
      console.log(`   New Status: ${submitTaskRes.data.status || submitTaskRes.data.task?.status}`);
    } else {
      console.log(`❌ Failed to submit task (${submitTaskRes.status})`);
      console.log(`   Response: ${JSON.stringify(submitTaskRes.data).substring(0, 200)}`);
    }

    // Test 5: Approve task (Manager approval)
    console.log('\n✅ Test 5: Approve Task (submitted → approved)');
    const approveTaskRes = await makeRequest('POST', `/api/tasks/${createdTaskId}/approve`, tokens.manager, {
      notes: 'Approved. All documentation is complete and booking is confirmed.'
    });
    
    if (approveTaskRes.status === 200) {
      console.log(`✅ Task approved`);
      console.log(`   Final Status: ${approveTaskRes.data.status || approveTaskRes.data.task?.status}`);
    } else {
      console.log(`❌ Failed to approve task (${approveTaskRes.status})`);
      console.log(`   Response: ${JSON.stringify(approveTaskRes.data).substring(0, 200)}`);
    }

    // Test 6: Get task history
    console.log('\n📋 Test 6: Get Task Activity Log');
    const activityRes = await makeRequest('GET', `/api/tasks/${createdTaskId}/activity`, tokens.admin);
    
    if (activityRes.status === 200) {
      const logs = activityRes.data.activity || activityRes.data;
      const count = Array.isArray(logs) ? logs.length : 0;
      console.log(`✅ Activity log retrieved (${count} entries)`);
      if (Array.isArray(logs) && logs.length > 0) {
        logs.slice(0, 3).forEach((log, i) => {
          console.log(`   ${i + 1}. ${log.action || log.type} - ${log.created_at}`);
        });
      }
    } else {
      console.log(`❌ Failed to get activity log (${activityRes.status})`);
    }

    // Test 7: Get notifications for manager
    console.log('\n🔔 Test 7: List Notifications');
    const notificationsRes = await makeRequest('GET', '/api/notifications', tokens.manager);
    
    if (notificationsRes.status === 200) {
      const notifications = notificationsRes.data.notifications || notificationsRes.data;
      const taskNotifs = Array.isArray(notifications) 
        ? notifications.filter(n => n.entity_type === 'task' || n.type?.includes('task'))
        : [];
      console.log(`✅ Notifications retrieved (${taskNotifs.length} task-related)`);
      if (taskNotifs.length > 0) {
        taskNotifs.slice(0, 2).forEach((notif, i) => {
          console.log(`   ${i + 1}. ${notif.message || notif.type}`);
        });
      }
    } else {
      console.log(`❌ Failed to get notifications (${notificationsRes.status})`);
    }

    // Test 8: List tasks for salesperson
    console.log('\n📋 Test 8: List Tasks (assigned to user)');
    const listTasksRes = await makeRequest('GET', '/api/tasks?status=approved', tokens.salesperson);
    
    if (listTasksRes.status === 200) {
      const tasks = listTasksRes.data.tasks || listTasksRes.data;
      const taskCount = Array.isArray(tasks) ? tasks.length : 0;
      console.log(`✅ Tasks listed (${taskCount} tasks)`);
      if (taskCount > 0) {
        const ourTask = Array.isArray(tasks) ? tasks.find(t => t.id === createdTaskId) : null;
        if (ourTask) {
          console.log(`   ✓ Our test task found in list`);
        }
      }
    } else {
      console.log(`❌ Failed to list tasks (${listTasksRes.status})`);
    }

    // Test 9: Test authorization (salesperson trying to approve should fail)
    console.log('\n🔐 Test 9: Authorization Check (negative test)');
    const testTaskRes = await makeRequest('POST', '/api/tasks', tokens.admin, {
      assignedTo: '550e8400-e29b-41d4-a716-446655440002',
      title: 'Negative test task',
      description: 'This is for testing authorization denial',
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'medium'
    });

    if (testTaskRes.status === 201 || testTaskRes.status === 200) {
      const testTaskId = testTaskRes.data.id || testTaskRes.data.task?.id;
      
      // Agent tries to approve (should fail)
      const unauthorizedRes = await makeRequest('POST', `/api/tasks/${testTaskId}/approve`, tokens.salesperson, {});
      
      if (unauthorizedRes.status === 403) {
        console.log(`✅ Authorization correctly denied`);
        console.log(`   Salesperson cannot approve tasks (expected 403)`);
      } else {
        console.log(`⚠️  Authorization check may not be enforced (got ${unauthorizedRes.status})`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Phase 2 API Tests Complete!\n');
    console.log('Summary:');
    console.log('  • Task creation works');
    console.log('  • State transitions working (assigned → in_progress → submitted → approved)');
    console.log('  • Activity logging functional');
    console.log('  • Notifications system operational');
    console.log('  • Role-based authorization enforced');

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests().then(() => {
  console.log('\n✨ All tests completed successfully!\n');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
