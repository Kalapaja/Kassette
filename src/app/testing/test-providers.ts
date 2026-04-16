/**
 * Angular providers applied to the TestBed environment by
 * `@angular/build:unit-test` before every spec runs. The builder auto-calls
 * `TestBed.initTestEnvironment(...)` with these providers, so specs don't
 * need to add them per `configureTestingModule`.
 */
import { provideZonelessChangeDetection } from '@angular/core';

export default [provideZonelessChangeDetection()];
