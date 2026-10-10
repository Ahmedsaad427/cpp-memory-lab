export type Scenario = { id: string; title: string; goal: string; code: string; cap?: number }
export const scenarios: Scenario[] = [
 { id: 'static', title: 'Static allocation', goal: 'الحجم ثابت والـ lifetime أوتوماتيك', code: `{\n  int x = 10;\n  int y = 20;\n  int arr[3] = {1, 2, 3};\n  x = 15;\n  arr[1] = 99;\n}` },
 { id: 'dyn', title: 'Dynamic int', goal: 'new / *p / delete / nullptr', code: `int* p;\np = new int;\n*p = 50;\n*p = 75;\ndelete p;\np = nullptr;` },
 { id: 'init', title: 'new int(25)', goal: 'allocation with initial value', code: `int* p = new int(25);\ndelete p;\np = nullptr;` },
 { id: 'array', title: 'Dynamic array', goal: 'new[] and delete[]', code: `int n = 5;\nint* arr = new int[n];\narr[2] = 99;\ndelete[] arr;\narr = nullptr;` },
 { id: 'alias', title: 'Pointer vs value', goal: 'p = &b  vs  *p = 50', code: `int a = 10;\nint b = 20;\nint* p = &a;\n*p = 50;\np = &b;\n*p = 60;` },
 { id: 'alias2', title: 'Aliasing', goal: 'two pointers, one object', code: `int* p = new int(7);\nint* q = p;\n*q = 8;\ndelete p;\np = nullptr;\nq = nullptr;` },
 { id: 'leak', title: 'Memory leak', goal: 'lose the last reference', code: `int* p = new int(100);\np = new int(200);` },
 { id: 'leakfix', title: 'Leak fixed', goal: 'delete before reassigning', code: `int* p = new int(100);\ndelete p;\np = new int(200);\ndelete p;\np = nullptr;` },
 { id: 'dangling', title: 'Dangling pointer', goal: 'pointer keeps old address', code: `int* p = new int(10);\ndelete p;\n// *p = 5;  <- invalid!\np = nullptr;` },
 { id: 'double', title: 'Double delete', goal: 'blocked undefined behavior', code: `int* p = new int(10);\ndelete p;\ndelete p;` },
 { id: 'fail', title: 'Allocation failure', goal: 'std::bad_alloc (set Heap capacity)', code: `int* a = new int[4];\nint* b = new int[10];\nint* c = new(std::nothrow) int[10];`, cap: 64 },
]
