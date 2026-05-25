const jwt=require('jsonwebtoken');console.log(jwt.sign({id:'test-agent',role:'agent'}, 'super-secret-key'))
