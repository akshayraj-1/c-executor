#include <stdio.h>

int main() {
    printf("Hello, World!\n");
    for(int i = 0; i < 10; i++) {
        printf("Iteration: %d\n", i);
    }
    int x;
    scanf("%d", &x);
    printf("x: %d", x);

    puts("\nHello, World!");
    putchar('2');

    int y;
    scanf("%d", &y);
    printf("y: %d", y);
    return 0;
}