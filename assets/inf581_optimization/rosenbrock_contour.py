#!/usr/bin/env python3

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm

# Rosenbrock function
def rosenbrock(x, y, a=1, b=100):
    return (a - x) ** 2 + b * (y - x ** 2) ** 2

# Create a grid of points
x = np.linspace(-2, 2, 400)
y = np.linspace(-2, 2, 400)
X, Y = np.meshgrid(x, y)
Z = rosenbrock(X, Y)

# Plot the level contours
plt.figure(figsize=(6, 6))
contour_levels = np.logspace(0, 5, 10)  # log scale for contour levels
contour = plt.contour(X, Y, Z, levels=contour_levels, norm=LogNorm(), cmap="viridis_r")
plt.xlabel(r'$x_1$')
plt.ylabel(r'$x_2$')
plt.clabel(contour, inline=1, fontsize=10)

# Save the figure to an SVG filec
plt.savefig('rosenbrock_contour.svg', format='svg', bbox_inches='tight')

plt.show()