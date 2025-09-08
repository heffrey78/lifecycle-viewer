// Simple test to verify filtering logic
const requirements = [
	{ id: 'REQ-001', title: 'User Authentication', status: 'Draft', type: 'FUNC', priority: 'P1' },
	{ id: 'REQ-002', title: 'Database Setup', status: 'Approved', type: 'TECH', priority: 'P0' },
	{ id: 'REQ-003', title: 'API Design', status: 'Under Review', type: 'FUNC', priority: 'P2' }
];

// Simulate the filtering logic from requirements page
function testFiltering(searchText = '', statusFilter = '', typeFilter = '', priorityFilter = '') {
	const filtered = requirements.filter((req) => {
		const matchesSearch =
			!searchText ||
			req.title.toLowerCase().includes(searchText.toLowerCase()) ||
			req.id.toLowerCase().includes(searchText.toLowerCase());

		const matchesStatus = !statusFilter || req.status === statusFilter;
		const matchesType = !typeFilter || req.type === typeFilter;
		const matchesPriority = !priorityFilter || req.priority === priorityFilter;

		return matchesSearch && matchesStatus && matchesType && matchesPriority;
	});

	return filtered;
}

// Test cases
console.log('All requirements:', testFiltering());
console.log('Search "auth":', testFiltering('auth'));
console.log('Status "Draft":', testFiltering('', 'Draft'));
console.log('Type "FUNC":', testFiltering('', '', 'FUNC'));
console.log('Priority "P0":', testFiltering('', '', '', 'P0'));
console.log('Combined filters:', testFiltering('user', '', 'FUNC', 'P1'));
